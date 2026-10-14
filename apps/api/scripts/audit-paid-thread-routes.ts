// Every LIVE, PAID thread that nobody can pay for — a list, not a change.
//
//   cd apps/api
//   npx tsx --env-file=.env scripts/audit-paid-thread-routes.ts prod --platform-stripe=on
//   npx tsx --env-file=.env.staging scripts/audit-paid-thread-routes.ts staging
//
// --platform-stripe=on judges card routes as if the platform Stripe key is
// set, which it is on the running production API. The env file in the main
// checkout carries no Stripe key, and the check never calls Stripe — it only
// asks whether a key exists — so a live secret pasted for it would be
// handling for nothing (coordinator review, 2026-10-14). The output says
// which assumption it ran under.
//
// The publish guard (lib/thread-payment-route.ts, 2026-10-14) stops a paid
// thread going live without a way to take the money. It cannot reach what
// went live BEFORE it existed, a Stripe account disconnected afterwards, or a
// thread published through the external /apps/* API (which the guard does not
// refuse — rule 8). This finds those, with the SAME function the guard and the
// enrol route use: `paymentRouteProblem`. No second statement of the rule.
//
// "Live" = programme active and public sign-up open — the state in which a
// visitor can press the button that dead-ends.
//
// It writes NOTHING. Exit 0 with a count; the rows are for whoever fixes them
// (connect Stripe, allow invoice, or close sign-up).

import { adminClient } from '../src/db.js';
import { paymentRouteProblem } from '../src/lib/thread-payment-route.js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';

const target = process.argv[2];
if (target !== 'prod' && target !== 'staging') {
  console.error('usage: npx tsx --env-file=<env> scripts/audit-paid-thread-routes.ts prod|staging [--platform-stripe=on]');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const want = target === 'prod' ? PRODUCTION_REF : STAGING_REF;
if (!url.includes(want)) {
  // Said out loud rather than trusted: the env file decides which database
  // this reads, and "prod" on the command line with the staging file would
  // report a clean production that was never looked at.
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}
const assumePlatformKey = process.argv.includes('--platform-stripe=on');
if (assumePlatformKey) {
  console.log('Assuming the platform Stripe key is set, as on the running API (--platform-stripe=on).\n');
} else if (!process.env.STRIPE_SECRET_KEY) {
  console.warn(
    'WARNING: no STRIPE_SECRET_KEY in this env file, so NO card route can be judged working —\n' +
      '  every paid card-only thread will be listed. Add --platform-stripe=on when the server has one.\n',
  );
}

const { data: threads, error } = await adminClient
  .from('thread_thread')
  .select(
    'id, slug, workspace_id, price_cents, public_enrolment_open, workspace:workspace_id (slug), program:program_id (title, status)',
  )
  // NULL counts as open, as it does in the guard and on the public page;
  // `.neq(false)` alone would drop NULL rows (NULL <> false is not true).
  .or('public_enrolment_open.is.null,public_enrolment_open.eq.true');
if (error) throw new Error(`threads: ${error.message}`);

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const live = (threads ?? []).filter(
  (t) => (one(t.program as never) as { status?: string } | null)?.status === 'active',
);

const stuck: string[] = [];
for (const t of live) {
  const problem = await paymentRouteProblem(t.id as string, {}, { assumePlatformKey });
  if (!problem) continue;
  const ws = (one(t.workspace as never) as { slug?: string } | null)?.slug ?? t.workspace_id;
  const title = (one(t.program as never) as { title?: string } | null)?.title ?? '(untitled)';
  stuck.push(`  ${ws} / ${t.slug} — ${title} (thread ${t.id})`);
}

console.log(`${target}: ${live.length} live threads with sign-up open; ${stuck.length} paid with NO working payment route.`);
if (stuck.length) {
  console.log(stuck.join('\n'));
  console.log('\nEach one: connect Stripe for its payout destination, allow invoice, or close sign-up.');
}
