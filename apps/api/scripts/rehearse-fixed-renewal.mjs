// Does Stripe actually bill the launch cohort the way we think it does?
//
//   FIBRE_ENV_FILE=/path/to/apps/.env.staging \
//   node apps/api/scripts/rehearse-fixed-renewal.mjs
//
// TEST MODE ONLY, and it refuses to run on anything else: the key must start
// sk_test. It creates a Stripe TEST CLOCK, a customer on it, and a
// subscription shaped exactly as routes/membership.ts shapes one for a tier
// whose `first_period_ends_on` is in the future — a one-off line for the
// period being paid for, a recurring line, `billing_cycle_anchor` the day
// after, `proration_behavior: 'none'`. Then it advances the clock past the
// anchor and reads what was charged.
//
// NO CARD NUMBER IS TYPED ANYWHERE. It uses Stripe's published test payment
// method token `pm_card_visa`, which is a fixture identifier, not a card.
//
// Why this exists: the mechanism was reasoned from Stripe's parameter docs and
// asserted at the source, and every one of those assertions could be right
// while Stripe still charged a proration nobody wanted. This is the one
// question the unit tests cannot answer — what Stripe DOES.
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
if (!key.startsWith('sk_test')) {
  throw new Error('refusing: STRIPE_SECRET_KEY is not a test key');
}
const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });

const PRICE = 30000; // €300.00, soul.com's "Community member" year price
const CURRENCY = 'eur';
const JOINED = Math.floor(Date.parse('2026-10-13T12:00:00Z') / 1000);
const ANCHOR = Math.floor(Date.parse('2027-01-01T00:00:00Z') / 1000); // the day after 31/12
const money = (c) => `${(c / 100).toFixed(2)} ${CURRENCY.toUpperCase()}`;
const when = (ts) => (ts ? new Date(ts * 1000).toISOString() : null);

console.log('— a test clock frozen on the day of the join —');
const clock = await stripe.testHelpers.testClocks.create({
  frozen_time: JOINED,
  name: 'fixed-renewal rehearsal',
});

const customer = await stripe.customers.create({
  email: 'rehearsal-cohort@example.com',
  test_clock: clock.id,
  payment_method: 'pm_card_visa',
  invoice_settings: { default_payment_method: 'pm_card_visa' },
});

// `add_invoice_items[].price_data` takes a product ID, not product_data (the
// Checkout line_items our route uses accept product_data; this is a quirk of
// the direct subscription API, not a difference in what gets billed).
const product = await stripe.products.create({ name: 'Rehearsal membership — Community member' });

console.log('— the subscription our join route would create —');
const sub = await stripe.subscriptions.create({
  customer: customer.id,
  items: [
    {
      price_data: {
        currency: CURRENCY,
        product: product.id,
        unit_amount: PRICE,
        recurring: { interval: 'year' },
      },
    },
  ],
  // The period being paid for NOW, as a one-off line on the first invoice —
  // the same shape the route uses for the cohort.
  add_invoice_items: [
    {
      price_data: {
        currency: CURRENCY,
        product: product.id,
        unit_amount: PRICE,
      },
    },
  ],
  // trial_end, not billing_cycle_anchor: Checkout REFUSES
  // proration_behavior 'none' alongside a one-time price, and without it
  // Stripe prorates the stub period and adds it to the first payment (365.35
  // instead of 300.00 — measured). A trial has no proration to argue with.
  trial_end: ANCHOR,
  payment_behavior: 'allow_incomplete',
  expand: ['latest_invoice'],
});

const first = sub.latest_invoice;
console.log(
  JSON.stringify(
    {
      step: 'AT THE JOIN',
      subscription_status: sub.status,
      first_invoice_total: first ? money(first.total) : null,
      first_invoice_lines: (first?.lines?.data ?? []).map((l) => ({
        description: l.description,
        amount: money(l.amount),
        proration: l.proration ?? false,
      })),
      next_charge: when(sub.items?.data?.[0]?.current_period_end ?? null),
    },
    null,
    2,
  ),
);

console.log('— advancing the clock past the anchor —');
await stripe.testHelpers.testClocks.advance(clock.id, {
  frozen_time: Math.floor(Date.parse('2027-01-02T12:00:00Z') / 1000),
});
// The advance is asynchronous; wait for the clock to settle.
for (let i = 0; i < 60; i++) {
  const c = await stripe.testHelpers.testClocks.retrieve(clock.id);
  if (c.status === 'ready') break;
  await new Promise((r) => setTimeout(r, 2000));
}

const invoices = await stripe.invoices.list({ customer: customer.id, limit: 10 });
console.log(
  JSON.stringify(
    {
      step: 'AFTER 1 JANUARY',
      invoices: invoices.data
        .map((inv) => ({
          created: when(inv.created),
          total: money(inv.total),
          status: inv.status,
          lines: inv.lines.data.map((l) => ({
            description: l.description,
            amount: money(l.amount),
            proration: l.proration ?? false,
          })),
        }))
        .reverse(),
    },
    null,
    2,
  ),
);

// Tidy up: the clock takes its customer, subscription and invoices with it.
await stripe.testHelpers.testClocks.del(clock.id);
console.log('— test clock deleted, nothing left behind —');
