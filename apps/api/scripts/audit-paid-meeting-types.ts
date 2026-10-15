// Every BOOKABLE, PAID meeting type that nobody can pay for — a list, not a
// change. The Meet twin of audit-paid-thread-routes.ts.
//
//   cd apps/api
//   npx tsx --env-file=.env scripts/audit-paid-meeting-types.ts prod --platform-stripe=on
//   npx tsx --env-file=.env.staging scripts/audit-paid-meeting-types.ts staging
//
// --platform-stripe=on judges card routes as if the platform Stripe key is
// set, as it is on the running production API; the check never calls Stripe,
// it only asks whether a key exists (see the thread audit for why).
//
// The save guard (lib/meet-payment-route.ts, 2026-10-16) stops a paid type
// becoming bookable without a way to take the money. It cannot reach what was
// bookable BEFORE it existed, or an account disconnected afterwards. This
// finds those with the SAME function the guard, the public page and the
// booking route use: `meetRouteProblem`. No second statement of the rule.
//
// "Bookable" = is_active and not archived — an unlisted type is still
// bookable by its link.
//
// It writes NOTHING. Exit 0 with a count; the rows are for whoever fixes them
// (connect Stripe, allow invoice, or switch the type off).

import { adminClient } from '../src/db.js';
import { meetRouteProblem } from '../src/lib/meet-payment-route.js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';

const target = process.argv[2];
if (target !== 'prod' && target !== 'staging') {
  console.error('usage: npx tsx --env-file=<env> scripts/audit-paid-meeting-types.ts prod|staging [--platform-stripe=on]');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const want = target === 'prod' ? PRODUCTION_REF : STAGING_REF;
if (!url.includes(want)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}
const assumePlatformKey = process.argv.includes('--platform-stripe=on');
if (assumePlatformKey) {
  console.log('Assuming the platform Stripe key is set, as on the running API (--platform-stripe=on).\n');
} else if (!process.env.STRIPE_SECRET_KEY) {
  console.warn(
    'WARNING: no STRIPE_SECRET_KEY in this env file, so NO card route can be judged working —\n' +
      '  every paid card-only type will be listed. Add --platform-stripe=on when the server has one.\n',
  );
}

const { data: types, error } = await adminClient
  .from('meet_meeting_type')
  .select('id, slug, name, host_id, price_cents, payment_methods, is_active, host:host_id (slug), workspace:workspace_id (slug)')
  .eq('is_active', true)
  .is('archived_at', null)
  .gt('price_cents', 0);
if (error) throw new Error(`meeting types: ${error.message}`);

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const stuck: string[] = [];
for (const t of types ?? []) {
  const problem = await meetRouteProblem(
    {
      host_id: t.host_id as string,
      price_cents: t.price_cents as number | null,
      payment_methods: t.payment_methods as string[] | null,
      is_active: true,
    },
    { assumePlatformKey },
  );
  if (!problem) continue;
  const ws = (one(t.workspace as never) as { slug?: string } | null)?.slug ?? '?';
  const host = (one(t.host as never) as { slug?: string } | null)?.slug ?? '?';
  stuck.push(`  ${ws} / ${host}/${t.slug} — ${t.name} (meeting type ${t.id})`);
}

console.log(`${target}: ${(types ?? []).length} bookable paid meeting types; ${stuck.length} with NO working payment route.`);
if (stuck.length) {
  console.log(stuck.join('\n'));
  console.log('\nEach one: connect Stripe for its host, allow invoice, or switch it off.');
}
