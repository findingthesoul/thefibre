// What the calendar WINDOW would send at launch — counts only (calendar gaps,
// slice 2; Sjoerd, 2026-10-17). Sjoerd runs this against PRODUCTION in his
// own terminal before he switches platform_setting `calendar_window` on:
//
//   cd apps/api
//   npx tsx --env-file=.env scripts/calendar-window-dry-run.ts prod
//   npx tsx --env-file=.env.staging scripts/calendar-window-dry-run.ts staging
//
// It uses the SAME planner the scheduler sends by (lib/calendar-window.ts
// planWindow), so these numbers are the mails that would go. Per thread:
// live participants, how many are skipped as calendar-feed followers, how
// many people would receive at least one invitation, and how many invitations
// in total. No names, no addresses.
//
// It writes NOTHING.

import { adminClient } from '../src/db.js';
import { WINDOW_CAP_PER_PASS, WINDOW_DAYS, countByThread, loadWindow, planWindow, windowSwitchOn } from '../src/lib/calendar-window.js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';

const target = process.argv[2];
if (target !== 'prod' && target !== 'staging') {
  console.error('usage: npx tsx --env-file=<env> scripts/calendar-window-dry-run.ts prod|staging');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const want = target === 'prod' ? PRODUCTION_REF : STAGING_REF;
if (!url.includes(want)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}

const input = await loadWindow(new Date());
const plan = planWindow(input);
const counts = countByThread(input, plan);
const ids = counts.map((c) => c.thread_id);
const { data: titles } = ids.length
  ? await adminClient.from('thread_thread').select('id, program:program_id (title)').in('id', ids)
  : { data: [] };
const titleOf = new Map(
  ((titles ?? []) as { id: string; program: { title: string } | { title: string }[] | null }[]).map((t) => [
    t.id,
    (Array.isArray(t.program) ? t.program[0] : t.program)?.title ?? '(untitled)',
  ]),
);

console.log(`Calendar window — the next ${WINDOW_DAYS} days, ${target}. Switch is ${(await windowSwitchOn()) ? 'ON' : 'off'}.\n`);
if (!counts.length) {
  console.log('Nothing would be sent.');
} else {
  console.log('thread\tlive\tfeed-skipped\tpeople\tinvitations\ttitle');
  for (const c of counts) console.log(`${c.thread_id}\t${c.live}\t${c.feed_skipped}\t${c.people}\t${c.invitations}\t${titleOf.get(c.thread_id) ?? ''}`);
  const sum = (k: 'live' | 'feed_skipped' | 'people' | 'invitations') => counts.reduce((n, c) => n + c[k], 0);
  console.log(`\nTOTAL: ${counts.length} threads, ${sum('people')} people, ${sum('invitations')} invitations (${sum('feed_skipped')} skipped as feed followers).`);
  const passes = Math.ceil(sum('invitations') / WINDOW_CAP_PER_PASS);
  console.log(`At ${WINDOW_CAP_PER_PASS} per pass (one pass every ~5 minutes), the launch takes ${passes} pass(es), about ${passes * 5} minutes; each pass sends for ~${Math.ceil(Math.min(sum('invitations'), WINDOW_CAP_PER_PASS) * 0.55 / 60)} minute(s).`);
}
