// Give every membership `thread` grant the ID of its thread — and say plainly
// which ones could not be given one. A dry run unless --apply.
//
//   cd apps/api
//   npx tsx --env-file=.env.staging scripts/backfill-thread-grant-ids.ts staging
//   npx tsx --env-file=.env.staging scripts/backfill-thread-grant-ids.ts staging --apply
//   npx tsx --env-file=.env scripts/backfill-thread-grant-ids.ts prod [--apply]
//
// Item 5 (2026-10-14). Grants used to hold only what the organiser typed — a
// slug, often a whole URL — so a renamed thread silently broke them. New
// grants are stored by id (POST /membership/grants checks and writes it).
// This brings the old ones over, through the SAME resolver the worker and
// the save use (lib/thread-grant.ts): the slug in the grant's own workspace,
// then the thread's slug history.
//
// IT REPORTS, IT DOES NOT GUESS. Exactly one thread = the id is written. No
// thread, or more than one = listed for a person to fix in Members, and the
// grant is left as it was. A grant enrols people; the wrong thread is worse
// than none.
//
// RE-ARMING. Members whose access row for a grant is stuck at `error` (the
// worker's "no thread …") are set back to `pending` once that grant resolves,
// so the next five-minute tick delivers what they were promised — but only
// for a membership that is active or in grace. A lapsed member's row is left.

import { adminClient } from '../src/db.js';
import { resolveGrantThread, GRANT_THREAD_PROBLEM } from '../src/lib/thread-grant.js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';
const target = process.argv[2];
const apply = process.argv.includes('--apply');
if (target !== 'prod' && target !== 'staging') {
  console.error('usage: npx tsx --env-file=<env> scripts/backfill-thread-grant-ids.ts prod|staging [--apply]');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(target === 'prod' ? PRODUCTION_REF : STAGING_REF)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}
console.log(`${target.toUpperCase()}  ${apply ? '*** APPLY ***' : 'DRY RUN — nothing is written'}\n`);

const { data: grants, error } = await adminClient
  .from('membership_access_grant')
  .select('id, workspace_id, config, workspace:workspace_id (slug), product:product_id (name), tier:tier_id (name)')
  .eq('kind', 'thread');
if (error) throw new Error(`grants: ${error.message}`);

const one = <T,>(v: unknown): T | null => (!v ? null : Array.isArray(v) ? ((v[0] ?? null) as T) : (v as T));
let written = 0;
let alreadyOk = 0;
let rearmed = 0;
const problems: string[] = [];

for (const g of grants ?? []) {
  const config = (g.config ?? {}) as Record<string, unknown>;
  const label = `${(one<{ slug: string }>(g.workspace)?.slug ?? g.workspace_id)} · ${one<{ name: string }>(g.product)?.name ?? one<{ name: string }>(g.tier)?.name ?? '?'} · "${String(config.thread_slug ?? '')}"`;
  const r = await resolveGrantThread(g.workspace_id as string, config);
  if (!r.ok) {
    problems.push(`  ${label}\n      ${GRANT_THREAD_PROBLEM[r.reason]}`);
    continue;
  }
  const hasId = config.thread_id === r.thread.id;
  if (hasId) alreadyOk += 1;
  else {
    console.log(`  ${label}  →  thread ${r.thread.id} ("${r.thread.slug}", via ${r.via})`);
    if (apply) {
      const { error: wErr } = await adminClient
        .from('membership_access_grant')
        .update({ config: { ...config, thread_id: r.thread.id, thread_slug: r.thread.slug } })
        .eq('id', g.id);
      if (wErr) {
        problems.push(`  ${label}\n      write failed: ${wErr.message}`);
        continue;
      }
    }
    written += 1;
  }

  // Re-arm this grant's stuck rows, for live memberships only.
  const { data: stuck, error: sErr } = await adminClient
    .from('membership_member_access')
    .select('id, member:member_id (status)')
    .eq('access_grant_id', g.id)
    .eq('status', 'error');
  if (sErr) throw new Error(`access rows: ${sErr.message}`);
  const live = (stuck ?? []).filter((row) => {
    const st = one<{ status: string }>(row.member)?.status;
    return st === 'active' || st === 'grace';
  });
  if (live.length) {
    console.log(`      ${live.length} stuck access row(s) ${apply ? 're-armed to pending' : 'would be re-armed to pending'}`);
    if (apply) {
      const { error: rErr } = await adminClient
        .from('membership_member_access')
        .update({ status: 'pending', last_error: null, updated_at: new Date().toISOString() })
        .in('id', live.map((row) => row.id));
      if (rErr) throw new Error(`re-arm: ${rErr.message}`);
    }
    rearmed += live.length;
  }
}

console.log(
  `\n${(grants ?? []).length} thread grant(s): ${alreadyOk} already by id, ${written} ${apply ? 'written' : 'to write'}, ${problems.length} need a person.` +
    (rearmed ? ` ${rearmed} stuck access row(s) ${apply ? 're-armed' : 'to re-arm'}.` : ''),
);
if (problems.length) console.log(`\nNEED A PERSON (left exactly as they were):\n${problems.join('\n')}`);
if (!apply && (written || rearmed)) console.log('\nDRY RUN — re-run with --apply to write.');
