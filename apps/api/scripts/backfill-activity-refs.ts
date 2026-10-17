// Give OLD activity rows their thread or booking (contacts follow the
// hierarchy, slice 2, step 3; Sjoerd, 2026-10-17: run the backfill).
//
// Rows written since v1.277.3 carry an activity_ref from birth. Rows from
// before carry only a label and a title in `subject` — "Registered: <program
// title>", "Meeting booked: <invitee name>" — so this script matches them,
// conservatively, and writes ONLY activity_ref. activity itself is
// append-only and is never touched (hard rule 5; "bulk data conversions: a
// script per database, never a migration").
//
//   cd apps/api
//   npx tsx --env-file=.env.staging scripts/backfill-activity-refs.ts staging          # dry run
//   npx tsx --env-file=.env.staging scripts/backfill-activity-refs.ts staging --apply
//   npx tsx --env-file=.env         scripts/backfill-activity-refs.ts prod             # Sjoerd's terminal
//   npx tsx --env-file=.env         scripts/backfill-activity-refs.ts prod --apply
//   npx tsx --env-file=.env         scripts/backfill-activity-refs.ts prod --restore <file>
//
// RESTORE FIRST (the bulk-conversion rule). Before --apply writes a single
// ref, it writes a restore file — every ref it is about to insert (workspace,
// activity id, target) — and prints its path (~/fibre-backfill/…). After the
// writes it rewrites the file with which ones it actually wrote. `--restore
// <file>` deletes exactly those refs again (activity_ref allows DELETE; only
// UPDATE is refused), and nothing else: a ref the file does not say this run
// wrote — one from a live writer, or another run — is never touched.
//
// THE MATCH, per row without a ref, inside the row's own workspace only:
//   · Thread types: the title after the label must equal the program title
//     of EXACTLY ONE thread the row's person is enrolled in (any status).
//     ("Paid: <slug>" — the old fallback — matches a thread slug the same way.)
//   · Meet types: the row's person must have EXACTLY ONE booking whose time
//     fits — for requested / booked / confirmed, created within 10 minutes of
//     the row; for moved, the person's only booking in the workspace.
//   · Anything else — no candidate, two candidates, a title since renamed —
//     stays without a ref. can_see_activity then shows it to admins only,
//     which is the rule for every unmatched row, by design (Sjoerd, (i)).
//
// Idempotent: a row that already has a ref is skipped, and a second run
// writes nothing new. The database checks every ref it writes (activity_ref
// trigger: same workspace as the row, thread or booking in that workspace).
//
// Prints counts only — per kind: matched, ambiguous, no candidate — never a
// name, title or address. Exit 0 on success, 1 on a read or write error.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { serviceRole, tenantDb } from '../src/lib/tenant-db.js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';

const target = process.argv[2];
const apply = process.argv.includes('--apply');
const restoreAt = process.argv.indexOf('--restore');
const restoreFile = restoreAt > 0 ? process.argv[restoreAt + 1] : undefined;
if ((target !== 'prod' && target !== 'staging') || (restoreAt > 0 && !restoreFile) || (apply && restoreFile)) {
  console.error('usage: npx tsx --env-file=<env> scripts/backfill-activity-refs.ts prod|staging [--apply | --restore <file>]');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(target === 'prod' ? PRODUCTION_REF : STAGING_REF)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}

type PlannedRef = { workspace_id: string; activity_id: string; ref_kind: 'thread' | 'meet_booking'; ref_id: string; written: boolean };
type RestoreFile = { target: string; created_at: string; refs: PlannedRef[] };

// ── --restore <file>: delete exactly the refs a run wrote, then stop. ──────
if (restoreFile) {
  const file = JSON.parse(readFileSync(restoreFile, 'utf8')) as RestoreFile;
  if (file.target !== target) {
    console.error(`REFUSED: ${restoreFile} was written for ${file.target}, not ${target}.`);
    process.exit(2);
  }
  const mine = file.refs.filter((r) => r.written);
  const byWs = new Map<string, PlannedRef[]>();
  for (const r of mine) byWs.set(r.workspace_id, [...(byWs.get(r.workspace_id) ?? []), r]);
  let deleted = 0;
  let failedRestore = false;
  for (const [ws, refs] of byWs) {
    const db = tenantDb(ws);
    // Per target, so a ref someone else wrote for the same row since — with
    // another thread or booking — is left alone.
    for (const kind of ['thread', 'meet_booking'] as const) {
      const ofKind = refs.filter((r) => r.ref_kind === kind);
      for (let i = 0; i < ofKind.length; i += 200) {
        const chunk = ofKind.slice(i, i + 200);
        for (const refId of [...new Set(chunk.map((r) => r.ref_id))]) {
          const ids = chunk.filter((r) => r.ref_id === refId).map((r) => r.activity_id);
          const { data, error } = await db
            .from('activity_ref')
            .delete()
            .eq('ref_kind', kind)
            .eq('ref_id', refId)
            .in('activity_id', ids)
            .select('activity_id');
          if (error) {
            console.error(`${ws}: could not delete refs: ${error.message}`);
            failedRestore = true;
          } else deleted += (data ?? []).length;
        }
      }
    }
  }
  console.log(`${target} — RESTORED from ${restoreFile}: ${deleted} of the ${mine.length} refs that run wrote are deleted.`);
  process.exit(failedRestore ? 1 : 0);
}

/** Thread types and the label each writer put before the title. */
const THREAD_LABELS: Record<string, string[]> = {
  enrolment_approved: ['Approved'],
  event_registered: ['Registered', 'Requested'],
  enrolment_declined: ['Declined'],
  enrolment_completed: ['Completed'],
  payment_received: ['Paid'],
  enrolment_checked_in: ['Checked in'],
  cancellation_requested: ['Cancellation requested'],
  cancellation_withdrawn: ['Cancellation withdrawn'],
  cancellation_approved: ['Cancellation approved'],
  cancellation_rejected: ['Cancellation declined'],
};
const MEET_TYPES = ['meeting_requested', 'meeting_booked', 'meeting_rescheduled'];
const BOOKING_WINDOW_MS = 10 * 60_000;

/** The title after a known label, or null when the subject has another shape. */
function titleOf(type: string, subject: string): string | null {
  for (const label of THREAD_LABELS[type] ?? []) {
    if (subject.startsWith(`${label}: `)) return subject.slice(label.length + 2);
  }
  return null;
}

type Row = { id: string; person_id: string; type: string; subject: string; occurred_at: string };
type Tally = { matched: number; ambiguous: number; none: number; written: number };
const tally: Record<'thread' | 'meet_booking', Tally> = {
  thread: { matched: 0, ambiguous: 0, none: 0, written: 0 },
  meet_booking: { matched: 0, ambiguous: 0, none: 0, written: 0 },
};
/** Why rows stayed without a ref — counts only, to judge the match. */
const why: Record<string, number> = {};
const because = (reason: string) => void (why[reason] = (why[reason] ?? 0) + 1);
let failed = false;
const plan: PlannedRef[] = [];

const { data: workspaces, error: wErr } = await serviceRole(
  'backfill script: lists workspace ids only, then processes each one through tenantDb',
)
  .from('workspace')
  .select('id')
  .order('id');
if (wErr) {
  console.error(`could not list workspaces: ${wErr.message}`);
  process.exit(1);
}

for (const { id: ws } of (workspaces ?? []) as { id: string }[]) {
  const db = tenantDb(ws);
  const types = [...Object.keys(THREAD_LABELS), ...MEET_TYPES];

  // Every candidate row of this workspace, paged.
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('activity')
      .select('id, person_id, type, subject, occurred_at')
      .in('type', types)
      .order('id')
      .range(from, from + 999);
    if (error) {
      console.error(`${ws}: could not read activity: ${error.message}`);
      failed = true;
      break;
    }
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  if (!rows.length) continue;

  // Skip rows that already have a ref.
  const have = new Set<string>();
  for (let i = 0; i < rows.length; i += 200) {
    const { data } = await db.from('activity_ref').select('activity_id').in('activity_id', rows.slice(i, i + 200).map((r) => r.id));
    for (const r of (data ?? []) as { activity_id: string }[]) have.add(r.activity_id);
  }
  const todo = rows.filter((r) => !have.has(r.id));
  if (!todo.length) continue;
  const people = [...new Set(todo.map((r) => r.person_id))];

  // Thread candidates: each person's threads, through their platform enrolments.
  const threadsOf = new Map<string, { id: string; title: string; slug: string }[]>();
  const { data: threads } = await db.from('thread_thread').select('id, slug, program_id');
  const byProgram = new Map(((threads ?? []) as { id: string; slug: string; program_id: string }[]).map((t) => [t.program_id, t]));
  if (byProgram.size) {
    const titleOfProgram = new Map<string, string>();
    const ids = [...byProgram.keys()];
    for (let p = 0; p < ids.length; p += 100) {
      const { data: programs } = await db.from('program').select('id, title').in('id', ids.slice(p, p + 100));
      for (const x of (programs ?? []) as { id: string; title: string }[]) titleOfProgram.set(x.id, x.title);
    }
    // enrolment has no workspace_id: reached through program, which does —
    // child() proves every program id is this workspace's first.
    const programIds = [...byProgram.keys()];
    for (let p = 0; p < programIds.length; p += 100) {
      const scoped = await db.child('enrolment', { via: 'program', key: 'program_id', id: programIds.slice(p, p + 100) });
      if (!scoped) {
        console.error(`${ws}: a thread's program is not in its workspace — skipped`);
        failed = true;
        continue;
      }
      for (let i = 0; i < people.length; i += 200) {
        const { data: enr, error: eErr } = await scoped.select('person_id, program_id').in('person_id', people.slice(i, i + 200));
        if (eErr) {
          console.error(`${ws}: could not read enrolments: ${eErr.message}`);
          failed = true;
          continue;
        }
        for (const e of (enr ?? []) as { person_id: string; program_id: string }[]) {
          const t = byProgram.get(e.program_id);
          if (!t) continue;
          const list = threadsOf.get(e.person_id) ?? [];
          list.push({ id: t.id, title: titleOfProgram.get(e.program_id) ?? '', slug: t.slug });
          threadsOf.set(e.person_id, list);
        }
      }
    }
  }

  // Meet candidates: each person's bookings in this workspace.
  const bookingsOf = new Map<string, { id: string; created_at: string }[]>();
  for (let i = 0; i < people.length; i += 200) {
    const { data: b } = await db.from('meet_booking').select('id, invitee_person_id, created_at').in('invitee_person_id', people.slice(i, i + 200));
    for (const x of (b ?? []) as { id: string; invitee_person_id: string; created_at: string }[]) {
      const list = bookingsOf.get(x.invitee_person_id) ?? [];
      list.push({ id: x.id, created_at: x.created_at });
      bookingsOf.set(x.invitee_person_id, list);
    }
  }

  const refs: { activity_id: string; ref_kind: 'thread' | 'meet_booking'; ref_id: string }[] = [];
  for (const r of todo) {
    if (MEET_TYPES.includes(r.type)) {
      const mine = bookingsOf.get(r.person_id) ?? [];
      const at = Date.parse(r.occurred_at);
      const fit = r.type === 'meeting_rescheduled' ? mine : mine.filter((b) => Math.abs(Date.parse(b.created_at) - at) <= BOOKING_WINDOW_MS);
      if (fit.length === 1) {
        tally.meet_booking.matched += 1;
        refs.push({ activity_id: r.id, ref_kind: 'meet_booking', ref_id: fit[0]!.id });
      } else {
        tally.meet_booking[fit.length ? 'ambiguous' : 'none'] += 1;
        because(fit.length ? 'meet: several bookings fit' : mine.length ? 'meet: no booking near that time' : 'meet: the person has no booking (left, or deleted)');
      }
      continue;
    }
    const title = titleOf(r.type, r.subject);
    const mine = threadsOf.get(r.person_id) ?? [];
    const fit = title === null ? [] : mine.filter((t) => t.title === title || (r.type === 'payment_received' && t.slug === title));
    const unique = [...new Map(fit.map((t) => [t.id, t])).values()];
    if (unique.length === 1) {
      tally.thread.matched += 1;
      refs.push({ activity_id: r.id, ref_kind: 'thread', ref_id: unique[0]!.id });
    } else {
      tally.thread[unique.length ? 'ambiguous' : 'none'] += 1;
      because(
        unique.length
          ? 'thread: several of their threads share the title'
          : title === null
            ? 'thread: subject not in a known shape'
            : mine.length
              ? 'thread: no thread of theirs has that title (renamed?)'
              : 'thread: the person is on no existing thread (deleted?)',
      );
    }
  }

  for (const r of refs) plan.push({ workspace_id: ws, ...r, written: false });
}

// ── --apply: the restore file FIRST, then the writes, then the file again. ──
let restorePath = '';
if (apply && plan.length) {
  const dir = join(homedir(), 'fibre-backfill');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  restorePath = join(dir, `activity-refs-${target}-${stamp}.json`);
  const save = () => writeFileSync(restorePath, JSON.stringify({ target, created_at: stamp, refs: plan } satisfies RestoreFile, null, 1));
  save();
  console.log(`restore file (written BEFORE any ref): ${restorePath}`);

  const byWs = new Map<string, PlannedRef[]>();
  for (const r of plan) byWs.set(r.workspace_id, [...(byWs.get(r.workspace_id) ?? []), r]);
  for (const [ws, refs] of byWs) {
    const db = tenantDb(ws);
    const row = (r: PlannedRef) => ({ activity_id: r.activity_id, ref_kind: r.ref_kind, ref_id: r.ref_id });
    for (let i = 0; i < refs.length; i += 200) {
      const chunk = refs.slice(i, i + 200);
      const { error } = await db.from('activity_ref').insert(chunk.map(row));
      if (!error) {
        for (const c of chunk) c.written = true;
        continue;
      }
      // A ref written meanwhile (a concurrent run, a live writer): go row by
      // row and let the existing one stand — and leave it out of the restore.
      for (const c of chunk) {
        const { error: one } = await db.from('activity_ref').insert(row(c));
        if (!one) c.written = true;
        else if (one.code !== '23505') {
          console.error(`${ws}: could not write a ref: ${one.message}`);
          failed = true;
        }
      }
    }
    save(); // after every workspace, so a crash mid-way still leaves an exact file
  }
  for (const r of plan) if (r.written) tally[r.ref_kind].written += 1;
}

console.log(`${target} — ${apply ? 'APPLIED' : 'dry run (nothing written; add --apply)'}`);
for (const [kind, t] of Object.entries(tally)) {
  console.log(`  ${kind.padEnd(12)} matched ${t.matched}, ambiguous ${t.ambiguous}, no candidate ${t.none}${apply ? `, written ${t.written}` : ''}`);
}
for (const [reason, n] of Object.entries(why).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(6)}  ${reason}`);
console.log('Unmatched rows keep no ref: once can_see_activity reads refs, admins see them and no one else.');
if (restorePath) console.log(`To undo exactly this run:  … backfill-activity-refs.ts ${target} --restore ${restorePath}`);
process.exit(failed ? 1 : 0);
