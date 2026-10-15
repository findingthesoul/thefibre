// Put a thread's items back where they were before its start date was moved —
// the shift that "Only change the start date" now prevents.
//
// Sjoerd, 2026-10-15: he moved the start date of a 2027 thread and every
// session moved with it. "In principle great behaviour, except that I did not
// want it." Until 1.21x the move was silent and recorded no history for drafts,
// messages or unsent sessions — but it moved EVERY dated item by ONE number of
// days. Given the original start date, that number is known, and the move can
// be reversed exactly.
//
//   cd apps/api
//   npx tsx --env-file=.env scripts/restore-thread-dates.ts prod --workspace <ws-slug> --thread <thread-slug> --was-start 2027-01-12
//   …add --apply to write.
//
// The dry run prints every dated item: now → restored. Where a sent session's
// calendar queue still holds the time before the move (thread_calendar_change
// `was`), it is cross-checked, and a session whose restored time would NOT
// match it is FLAGGED — it was moved separately since — and --apply leaves it
// alone. --apply moves the rest back by the same number of days (starts_at,
// ends_at, scheduled_at; the per-day schedule only where it moved with the
// session — the old shift left it in place), restores the thread's start
// and end dates, and queues the calendar change for each sent session, as a
// move in the editor would.

import { adminClient } from '../src/db.js';
import { calendarStateOf, isCalendarSession, recordCalendarChange } from '../src/lib/calendar-invite.js';
import { shiftDailySchedule } from '../src/routes/thread.js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';
const args = process.argv.slice(2);
const target = args[0];
const arg = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const wsSlug = arg('--workspace');
const threadSlug = arg('--thread');
const wasStart = arg('--was-start');
const apply = args.includes('--apply');
if ((target !== 'prod' && target !== 'staging') || !wsSlug || !threadSlug || !wasStart || !/^\d{4}-\d{2}-\d{2}$/.test(wasStart)) {
  console.error('usage: npx tsx --env-file=<env> scripts/restore-thread-dates.ts prod|staging --workspace <slug> --thread <slug> --was-start YYYY-MM-DD [--apply]');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(target === 'prod' ? PRODUCTION_REF : STAGING_REF)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}

const shiftDate = (d: string, days: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
};
const shiftTs = (iso: string, days: number) => {
  const x = new Date(iso);
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString();
};

const { data: ws } = await adminClient.from('workspace').select('id').eq('slug', wsSlug).maybeSingle();
if (!ws) throw new Error(`workspace ${wsSlug} not found`);
const { data: thread } = await adminClient
  .from('thread_thread')
  .select('id, slug, program_id, program:program_id (title, starts_on, ends_on)')
  .eq('workspace_id', ws.id)
  .eq('slug', threadSlug)
  .maybeSingle();
if (!thread) throw new Error(`thread ${threadSlug} not found in ${wsSlug}`);
const program = (Array.isArray(thread.program) ? thread.program[0] : thread.program) as { title: string; starts_on: string | null; ends_on: string | null };
if (!program.starts_on) throw new Error('the thread has no start date');
const moved = Math.round((Date.parse(program.starts_on) - Date.parse(wasStart)) / 86_400_000);
if (moved === 0) {
  console.log(`"${program.title}" already starts on ${wasStart}. Nothing to restore.`);
  process.exit(0);
}
const back = -moved;
console.log(`${target} · "${program.title}" (${wsSlug}/${threadSlug}) · ${apply ? 'APPLYING' : 'dry run'}`);
console.log(`  start ${program.starts_on} → ${wasStart}   (it was moved ${Math.abs(moved)} days ${moved > 0 ? 'later' : 'earlier'}; moving back ${Math.abs(back)} days)`);
if (program.ends_on) console.log(`  end   ${program.ends_on} → ${shiftDate(program.ends_on, back)}`);

const { data: rows, error } = await adminClient.from('thread_engagement').select('*').eq('thread_id', thread.id).order('position');
if (error) throw new Error(`engagements: ${error.message}`);
const { data: changes } = await adminClient
  .from('thread_calendar_change')
  .select('engagement_id, kind, was, created_at')
  .eq('thread_id', thread.id)
  .eq('kind', 'moved');
const wasById = new Map<string, string>();
for (const ch of changes ?? []) {
  const w = (ch.was as { starts_at?: string } | null)?.starts_at;
  if (w && ch.engagement_id) wasById.set(ch.engagement_id as string, w);
}

type Plan = { e: Record<string, unknown>; patch: Record<string, unknown>; flagged: string | null };
const plans: Plan[] = [];
for (const e of rows ?? []) {
  const patch: Record<string, unknown> = {};
  if (e.starts_at) patch.starts_at = shiftTs(e.starts_at, back);
  if (e.ends_at) patch.ends_at = shiftTs(e.ends_at, back);
  if (e.scheduled_at) patch.scheduled_at = shiftTs(e.scheduled_at, back);
  // The per-day dates only when they MOVED with the session: the shift
  // before this fix left them where they were (it moved starts_at, not the
  // days), so on such a row they already hold the original dates and moving
  // them back would move them twice. Rehearsal on staging caught exactly that.
  const sched = Array.isArray(e.daily_schedule) ? (e.daily_schedule as { date: string }[]) : null;
  const firstDay = sched?.[0]?.date ?? null;
  const shiftedStartDay = e.starts_at ? new Date(e.starts_at as string).toISOString().slice(0, 10) : null;
  if (firstDay && shiftedStartDay && firstDay === shiftedStartDay) {
    const days = shiftDailySchedule(e.daily_schedule, back);
    if (days) patch.daily_schedule = days;
  }
  if (!Object.keys(patch).length) continue;
  const was = wasById.get(e.id as string);
  const flagged = was && patch.starts_at && Date.parse(was) !== Date.parse(patch.starts_at as string) ? `calendar queue says it was ${was} — moved separately since?` : null;
  plans.push({ e, patch, flagged });
  const now = (e.starts_at ?? e.scheduled_at) as string;
  const then = (patch.starts_at ?? patch.scheduled_at) as string;
  console.log(`  ${flagged ? '⚠' : '·'} ${String(e.title).slice(0, 50).padEnd(50)} ${now} → ${then}${was && !flagged ? '  ✓ matches the calendar queue' : ''}${flagged ? `  ⚠ ${flagged} (left alone)` : ''}`);
}

if (!apply) {
  console.log(`\n${plans.length} item(s) would move back (${plans.filter((p) => p.flagged).length} flagged, left alone). Dry run — nothing changed. Add --apply to write.`);
  process.exit(0);
}

let done = 0;
for (const p of plans) {
  if (p.flagged) continue;
  const { data: after, error: upErr } = await adminClient.from('thread_engagement').update(p.patch).eq('id', p.e.id).select('*').single();
  if (upErr) {
    console.log(`  ✗ ${p.e.title}: ${upErr.message}`);
    continue;
  }
  done++;
  if (after && isCalendarSession(after)) {
    try {
      await recordCalendarChange({ engagement: after, kind: 'moved', before: calendarStateOf(p.e as never), actorUserId: null });
    } catch (err) {
      console.log(`  ⚠ ${p.e.title}: moved back, but the calendar change was not queued — ${(err as Error).message}`);
    }
  }
}
const programPatch: Record<string, string> = { starts_on: wasStart };
if (program.ends_on) programPatch.ends_on = shiftDate(program.ends_on, back);
const { error: pErr } = await adminClient.from('program').update(programPatch).eq('id', thread.program_id);
if (pErr) throw new Error(`program: ${pErr.message}`);
console.log(`\n${done} item(s) moved back; the thread starts on ${wasStart} again. Calendar changes are queued for sent sessions — the organiser sends them from the editor, as after any move.`);
