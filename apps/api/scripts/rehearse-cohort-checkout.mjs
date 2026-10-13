// What CHECKOUT says it will charge for a cohort join — the real path.
//
//   FIBRE_ENV_FILE=…/.env.staging node apps/api/scripts/rehearse-cohort-checkout.mjs
//
// The direct-subscription rehearsal (rehearse-fixed-renewal.mjs) found that
// `add_invoice_items` + a future `billing_cycle_anchor` charges NOTHING at the
// join and everything at the anchor. But that is not the path our join takes:
// routes/membership.ts creates a CHECKOUT SESSION whose `line_items` include a
// non-recurring line, and in Checkout a non-recurring line is collected in the
// session's own payment — which is how this codebase already bills add-on
// products ("a one-time line item on the first invoice").
//
// So this builds the session exactly as the route builds it and reads back
// what Stripe says it will collect. It does not complete the payment: nothing
// here types a card, and `amount_total` is Stripe's own answer to "what will
// this person be charged now".
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

const PRICE = 30000;
const CURRENCY = 'eur';
const ANCHOR = Math.floor(Date.parse('2027-01-01T00:00:00Z') / 1000);
const money = (c) => (c == null ? null : `${(c / 100).toFixed(2)} ${CURRENCY.toUpperCase()}`);

async function session(label, lines, subscriptionData) {
  const s = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: lines,
    subscription_data: subscriptionData,
    customer_email: 'rehearsal-checkout@example.com',
    success_url: 'https://membership.thefibre.tech/joined',
    cancel_url: 'https://membership.thefibre.tech/',
  });
  return {
    label,
    amount_total_NOW: money(s.amount_total),
    amount_subtotal: money(s.amount_subtotal),
    status: s.status,
  };
}

const oneOff = {
  price_data: {
    currency: CURRENCY,
    product_data: { name: 'Membership — Community member (2026)' },
    unit_amount: PRICE,
  },
  quantity: 1,
};
const recurring = {
  price_data: {
    currency: CURRENCY,
    product_data: { name: 'Membership — Community member' },
    unit_amount: PRICE,
    recurring: { interval: 'year' },
  },
  quantity: 1,
};

async function trySession(label, lines, subscriptionData) {
  try {
    return await session(label, lines, subscriptionData);
  } catch (e) {
    // A refusal IS the answer for some of these shapes, so it is reported
    // rather than thrown: Stripe saying no is what we came to find out.
    return { label, REFUSED: e.message };
  }
}

const out = [];
// 1. What an ORDINARY join charges — the control, so a number can be compared
//    against something rather than judged alone.
out.push(await trySession('A ordinary join (recurring only, no anchor)', [recurring], {}));
// 2. What the route builds TODAY.
out.push(
  await trySession('B SHIPPED: one-off + recurring, anchor, proration none', [oneOff, recurring], {
    billing_cycle_anchor: ANCHOR,
    proration_behavior: 'none',
  }),
);
// 3..n The candidates, measured rather than reasoned.
out.push(
  await trySession('C one-off + recurring, anchor, NO proration param', [oneOff, recurring], {
    billing_cycle_anchor: ANCHOR,
  }),
);
out.push(
  await trySession('D one-off + recurring, trial_end 1 Jan', [oneOff, recurring], {
    trial_end: ANCHOR,
  }),
);
out.push(
  await trySession('E recurring only, anchor, proration none', [recurring], {
    billing_cycle_anchor: ANCHOR,
    proration_behavior: 'none',
  }),
);
console.log(JSON.stringify(out, null, 2));
