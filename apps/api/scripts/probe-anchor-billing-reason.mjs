// WHEN A COHORT ANCHOR ARRIVES, WHAT DOES STRIPE CALL THE INVOICE?
//
//   FIBRE_ENV_FILE=…/.env.staging node apps/api/scripts/probe-anchor-billing-reason.mjs
//
// THE QUESTION, and why it needed its own probe. `membershipInvoicePaid`
// decides a payment is a renewal with
//
//     invoice.billing_reason === 'subscription_cycle'
//
// and only then writes the `membership_renewed` activity and re-runs
// `reconcileMemberAccess`. A cohort join reaches its first real renewal by a
// TRIAL EXPIRING — not by an ordinary cycle — so if Stripe names that invoice
// anything else, every cohort member's renewal is collected and recorded as
// money but never recognised as a renewal, and their access is never
// reconciled.
//
// `rehearse-extras-ledger.mjs` could not answer this. It brings the anchor
// forward with `trial_end: 'now'`, and that is an UPDATE to the subscription,
// so Stripe quite correctly called the invoice `subscription_update` — a
// property of the rehearsal, not of the product. Guessing past it would have
// meant asserting the one thing in doubt.
//
// So this uses a TEST CLOCK, where the trial ends because the date arrived.
// Nothing else reproduces that.
//
// Pure Stripe test-mode, no database, no webhook: one customer, one
// subscription, one clock, all on the staging connected account, all deleted.
import { readFileSync } from 'node:fs';
import Stripe from 'stripe';

const envFile = process.env.FIBRE_ENV_FILE;
if (!envFile) {
  console.error('set FIBRE_ENV_FILE to the staging env file');
  process.exit(2);
}
const env = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const key = env.STRIPE_SECRET_KEY ?? '';
if (!key.startsWith('sk_test')) throw new Error('refusing: not a test key');
const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });

const ACCOUNT = process.env.STRIPE_ACCOUNT ?? null;
const on = ACCOUNT ? { stripeAccount: ACCOUNT } : undefined;
const money = (c) => (c == null ? null : (c / 100).toFixed(2));

const TIER = 30000;
const EXTRA = 19320;
const made = { clock: null, customer: null, sub: null, products: [] };

async function cleanup() {
  if (made.sub) await stripe.subscriptions.cancel(made.sub, {}, on).catch(() => {});
  for (const id of made.products) await stripe.products.del(id, {}, on).catch(() => {});
  if (made.customer) await stripe.customers.del(made.customer, {}, on).catch(() => {});
  // Deleting the clock takes its customers and subscriptions with it; it is
  // last so the explicit deletions above can report their own failures.
  if (made.clock) await stripe.testHelpers.testClocks.del(made.clock, {}, on).catch(() => {});
}

// A clock advance is asynchronous: it reports `advancing` and the simulated
// billing happens while it settles. Polling for `ready` is the documented way
// to know Stripe has finished, and a fixed sleep would be a race.
async function settle(label) {
  for (let i = 0; i < 40; i += 1) {
    const clock = await stripe.testHelpers.testClocks.retrieve(made.clock, {}, on);
    if (clock.status === 'ready') return clock;
    if (clock.status === 'internal_failure') throw new Error(`the test clock failed (${label})`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`the test clock never became ready (${label})`);
}

try {
  const START = Math.floor(Date.now() / 1000);
  const clock = await stripe.testHelpers.testClocks.create({ frozen_time: START }, on);
  made.clock = clock.id;
  console.log(`test clock ${clock.id} frozen at ${new Date(START * 1000).toISOString()}`);

  const customer = await stripe.customers.create(
    {
      email: `probe-anchor-${START}@example.com`,
      name: 'Anchor Probe',
      test_clock: clock.id,
      payment_method: 'pm_card_visa',
      invoice_settings: { default_payment_method: 'pm_card_visa' },
    },
    on,
  );
  made.customer = customer.id;

  const productFor = async (name) => {
    const p = await stripe.products.create({ name }, on);
    made.products.push(p.id);
    return p.id;
  };

  // The cohort shape in miniature: a tier and one recurring extra, both
  // split — a one-off line for the first period, a recurring line from the
  // anchor — with the anchor three days out so the clock can pass it.
  const ANCHOR = START + 3 * 86400;
  const sub = await stripe.subscriptions.create(
    {
      customer: customer.id,
      items: [
        {
          price_data: {
            currency: 'eur',
            product: await productFor('Membership'),
            unit_amount: TIER,
            recurring: { interval: 'year' },
          },
        },
        {
          price_data: {
            currency: 'eur',
            product: await productFor('An extra'),
            unit_amount: EXTRA,
            recurring: { interval: 'year' },
          },
        },
      ],
      add_invoice_items: [
        {
          price_data: {
            currency: 'eur',
            product: await productFor('Membership — first period'),
            unit_amount: TIER,
          },
        },
        {
          price_data: {
            currency: 'eur',
            product: await productFor('An extra — first period'),
            unit_amount: EXTRA,
          },
        },
      ],
      trial_end: ANCHOR,
    },
    on,
  );
  made.sub = sub.id;
  console.log(`subscription ${sub.id} status=${sub.status}, anchor in 3 days`);

  // PAST THE ANCHOR. The trial now ends because the date arrived, which is
  // the whole point of the probe.
  console.log('\nadvancing the clock past the anchor…');
  await stripe.testHelpers.testClocks.advance(made.clock, { frozen_time: ANCHOR + 3600 }, on);
  await settle('past the anchor');

  const invoices = await stripe.invoices.list({ subscription: sub.id, limit: 20 }, on);
  console.log(`\ninvoices: ${invoices.data.length}`);
  for (const inv of invoices.data) {
    console.log(
      `  reason=${String(inv.billing_reason).padEnd(20)} status=${String(inv.status).padEnd(6)} total=${money(inv.total)}`,
    );
  }

  const join = invoices.data.find((i) => i.billing_reason === 'subscription_create');
  // The anchor invoice is whichever one is NOT the join's. Named by exclusion
  // on purpose: naming the reason I expect would make the probe agree with me
  // rather than with Stripe.
  const anchor = invoices.data.find((i) => i.id !== join?.id);

  console.log('\n--- the answer ---');
  console.log(`at the join:   ${money(join?.total)}  reason=${join?.billing_reason}`);
  console.log(`at the anchor: ${money(anchor?.total)}  reason=${anchor?.billing_reason}`);
  if (!anchor) {
    console.log('\nNO ANCHOR INVOICE — the trial expiry billed nothing.');
    process.exitCode = 1;
  } else if (anchor.billing_reason === 'subscription_cycle') {
    console.log(
      '\nRECOGNISED: a trial expiring at the anchor IS a subscription_cycle, so\n' +
        'membershipInvoicePaid writes the renewal activity and reconciles access.',
    );
  } else {
    console.log(
      `\nNOT RECOGNISED: the anchor invoice is "${anchor.billing_reason}", and\n` +
        'membershipInvoicePaid only treats subscription_cycle as a renewal — so a\n' +
        'cohort renewal would be collected and ledgered but never recognised:\n' +
        'no membership_renewed activity and no reconcileMemberAccess.',
    );
    process.exitCode = 1;
  }
} finally {
  console.log('\ncleaning up…');
  await cleanup();
  console.log('cleaned up');
}
