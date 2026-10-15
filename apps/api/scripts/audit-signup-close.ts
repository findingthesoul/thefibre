// Every thread whose sign-up is OPEN today but would be CLOSED by the new
// sign-up window — a list, not a change. Run before thread dates slice 2
// lands (coordinator, from Sjoerd, 2026-10-16: "so nothing surprises him").
//
//   cd apps/api
//   npx tsx --env-file=.env scripts/audit-signup-close.ts prod
//   npx tsx --env-file=.env.staging scripts/audit-signup-close.ts staging
//
// "Open today" = programme active and public sign-up switched on — what the
// enrol route accepts now (it reads no date). "Would close" = the new rule
// (@thefibre/shared/thread-dates, loaded by lib/thread-dates.ts — the same
// function slice 2 will enforce) puts the close moment at or before NOW.
// It also lists, separately, those that would close within 14 days.
//
// It writes NOTHING. Exit 0 with counts.

import { adminClient } from '../src/db.js';
import { loadThreadDates } from '../src/lib/thread-dates.js';
import { signupsOpenAt } from '@thefibre/shared/thread-dates';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';

const target = process.argv[2];
if (target !== 'prod' && target !== 'staging') {
  console.error('usage: npx tsx --env-file=<env> scripts/audit-signup-close.ts prod|staging');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(target === 'prod' ? PRODUCTION_REF : STAGING_REF)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}

const { data: threads, error } = await adminClient
  .from('thread_thread')
  .select('id, slug, team_id, public_enrolment_open, workspace:workspace_id (slug), program:program_id (title, status)')
  .or('public_enrolment_open.is.null,public_enrolment_open.eq.true');
if (error) throw new Error(`threads: ${error.message}`);

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const open = (threads ?? []).filter((t) => (one(t.program as never) as { status?: string } | null)?.status === 'active');
const dates = await loadThreadDates(open.map((t) => t.id as string));

const now = new Date();
const soon = new Date(now.getTime() + 14 * 86_400_000);
const closed: string[] = [];
const closing: string[] = [];
for (const t of open) {
  const d = dates.get(t.id as string);
  if (!d?.signupsCloseAt) continue;
  const ws = (one(t.workspace as never) as { slug?: string } | null)?.slug ?? '?';
  const title = (one(t.program as never) as { title?: string } | null)?.title ?? '(untitled)';
  const line = `  ${ws} / ${t.slug} — ${title}: closes ${d.signupsCloseAt} (${d.closeRule}${t.team_id ? ', team' : ''}) [thread ${t.id}]`;
  if (!signupsOpenAt(d, now)) closed.push(line);
  else if (!signupsOpenAt(d, soon)) closing.push(line);
}

console.log(`${target}: ${open.length} threads with sign-up open today.`);
console.log(`\n${closed.length} would be CLOSED the moment the new rule is enforced:`);
if (closed.length) console.log(closed.join('\n'));
console.log(`\n${closing.length} would close within 14 days:`);
if (closing.length) console.log(closing.join('\n'));
console.log('\nTo keep one open: star a later key moment, or choose "close when this session starts" for a later session.');
