// A cohort join WITH optional extras: what does Stripe collect, and when?
//
//   FIBRE_ENV_FILE=…/.env.staging node apps/api/scripts/rehearse-cohort-extras.mjs
//
// Sjoerd's own production panel, 2026-10-14: soul.com "Community member"
// €300/year on a cohort tier, with three extras ticked — Google Workspace
// €193.20/year, Fellowship €2,000/year, Accreditation €1,000 one-time. The
// panel says "You pay € 3.493,20 now."
//
// THE QUESTION. The earlier cohort and discount rehearsals covered the TIER
// lines only. An extra whose interval matches the join is built as a RECURRING
// line — and every recurring line on a subscription with `trial_end` is
// charged at the ANCHOR, not now. So the yearly extras may be moving to 1
// January while the panel promises them today.
//
// `--fixed` builds the shape that makes the panel true instead: every
// recurring extra is split exactly like the tier — a one-off line now for its
// first period, and a recurring line at full price from the anchor. One-time
// extras are charged now either way.
//
// Nothing here completes a payment; `amount_total` is Stripe's own answer to
// "what is collected now". Every session is expired afterwards.
import { readFileSync } from 'node:fs';
import Stripe from 'stripe';

const envFile = process.env.FIBRE_ENV_FILE;
if (!envFile) {
  console.error('set FIBRE_ENV_FILE to the staging env file');
  process.exit(2);
}
const raw = readFileSync(envFile, 'utf8');
const env = Object.fromEntries(
  raw
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const key = env.STRIPE_SECRET_KEY ?? '';
if (!key.startsWith('sk_test')) throw new Error('refusing: not a test key');
const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });

const CURRENCY = 'eur';
const ANCHOR = Math.floor(Date.parse('2027-01-01T00:00:00Z') / 1000);
const money = (c) => (c == null ? null : (c / 100).toFixed(2));

const TIER = 30000; // €300.00
const EXTRAS = [
  { name: 'email@soul.com / Google Workspace', cents: 19320, interval: 'year' },
  { name: 'Fellowship', cents: 200000, interval: 'year' },
  { name: 'Accreditation program', cents: 100000, interval: 'once' },
];

// `--broken` reproduces the shape production had before 2026-10-14, so this
// can show the fault as well as its absence. Without it, the lines are built
// the way routes/membership.ts builds them NOW — and the assertion at the
// bottom reads the route's own source to check this script has not drifted
// from it, because a rehearsal that agrees with a stale model of the route
// proves nothing about the route.
const fixed = !process.argv.includes('--broken');
const withCode = process.argv.includes('--code');
// A 50% code applies to the TIER only. Extras are not discounted unless a
// code names one, which is a scope this does not exercise.
const tierNow = withCode ? TIER / 2 : TIER;

const line = (name, cents, recurring) => ({
  price_data: {
    currency: CURRENCY,
    product_data: { name },
    unit_amount: cents,
    ...(recurring ? { recurring: { interval: recurring } } : {}),
  },
  quantity: 1,
});

const items = [
  // The tier: its first period as a one-off, and the subscription from the
  // anchor at the FULL price.
  line('Membership — first period', tierNow, null),
  line('Membership', TIER, 'year'),
  ...EXTRAS.flatMap((x) => {
    if (x.interval === 'once') return [line(x.name, x.cents, null)];
    if (!fixed) {
      // TODAY'S SHAPE: a recurring line, which a trial moves to the anchor.
      return [line(x.name, x.cents, 'year')];
    }
    // THE FIX: split like the tier.
    return [line(`${x.name} — first period`, x.cents, null), line(x.name, x.cents, 'year')];
  }),
];

const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: items,
  subscription_data: { trial_end: ANCHOR },
  payment_method_collection: 'always',
  success_url: 'https://example.com/ok',
  cancel_url: 'https://example.com/no',
});

const recurringTotal = items
  .filter((i) => i.price_data.recurring)
  .reduce((n, i) => n + i.price_data.unit_amount, 0);

console.log(`${fixed ? 'THE SHAPE THE ROUTE BUILDS' : 'THE OLD SHAPE (--broken)'}${withCode ? ' + a 50% code on the tier' : ''}`);
console.log(`  lines: ${items.length}`);
for (const i of items) {
  console.log(
    `    ${money(i.price_data.unit_amount).padStart(9)}  ${
      i.price_data.recurring ? 'recurring' : 'one-off  '
    }  ${i.price_data.product_data.name}`,
  );
}
console.log(`\n  STRIPE COLLECTS NOW:  ${money(session.amount_total)}`);
console.log(`  AT THE ANCHOR (1 Jan): ${money(recurringTotal)}`);
console.log(`  panel currently says:  ${money(tierNow + EXTRAS.reduce((n, x) => n + x.cents, 0))}`);

await stripe.checkout.sessions.expire(session.id).catch(() => {});
console.log('\n(session expired)');

// AND THE SCRIPT IS HELD TO THE ROUTE. These shapes are only evidence if they
// are the ones the route builds; a rehearsal drifting from the code it stands
// for is worse than none, because it reports success about the wrong thing.
if (fixed) {
  const route = readFileSync(
    new URL('../src/routes/membership.ts', import.meta.url),
    'utf8',
  );
  const splits = route.includes('return split ? [once, recurs] : [recurs];');
  const tierOneOff = route.includes('...(split ? {} : { recurring: { interval: d.interval } })');
  console.log(`\nthe route splits recurring extras when billing starts later: ${splits}`);
  console.log(`the route makes the paid-now tier line one-off:              ${tierOneOff}`);
  if (!splits || !tierOneOff) {
    console.error('\nTHIS SCRIPT NO LONGER MATCHES THE ROUTE — the numbers above are about nothing.');
    process.exitCode = 1;
  }
}
