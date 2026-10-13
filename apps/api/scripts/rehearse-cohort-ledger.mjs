// Does a COHORT join reach the ledger at all?
//
//   FIBRE_ENV_FILE=…/.env.staging node apps/api/scripts/rehearse-cohort-ledger.mjs
//
// THE QUESTION. The launch-cohort join pays its first period as a ONE-OFF
// line in a Checkout session whose subscription starts in a trial. Purchase
// rows are written in `membershipInvoicePaid`, from `invoice.paid`. If Stripe
// collects that one-off through the session's own PaymentIntent rather than
// through a subscription invoice, no invoice.paid fires — and the money is
// taken with no ledger row, no receipt and nothing in /admin/economics until
// the first renewal a year later.
//
// It has never been exercised: no tier on either stack carries
// `first_period_ends_on`, so every real join so far has billed through an
// ordinary first invoice, which does produce the row.
//
// WHY THIS SHAPE. Checkout's subscription mode turns one-time line items into
// the subscription's first-invoice items, so this builds that directly:
// `subscriptions.create` with the recurring price, `add_invoice_items`
// carrying the one-off, `trial_end` at the cohort anchor, and the same
// metadata the join route puts on `subscription_data`. No card is typed
// anywhere — `pm_card_visa` is Stripe's own test token.
//
// It writes a fixture tier, a fixture person and one test-mode charge on the
// STAGING connected account, waits for the deployed webhook, reads what it
// made, and removes everything it created.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
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
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes('lukhyylwhhjyihqtghvw')) throw new Error('refusing: not the staging project');

const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const stamp = Date.now();
const EMAIL = `int-cohort-ledger-${stamp}@example.com`;
const END = '2026-12-31';
const ANCHOR = Math.floor(Date.parse(`${END}T00:00:00Z`) / 1000) + 86400;
const FULL = 30000;
const money = (c) => (c == null ? null : `${(c / 100).toFixed(2)}`);

const cleanup = { subs: [], customers: [], products: [], tierId: null, personId: null, memberIds: [], purchaseIds: [] };

try {
  // The workspace whose connected account the deployed webhook listens on —
  // resolved the way lib/payment-accounts.ts resolves it, not guessed.
  const { data: ws } = await db
    .from('workspace')
    .select('id, name, slug, stripe_account_id')
    .eq('slug', 'default')
    .single();
  const account = ws.stripe_account_id;
  if (!account) throw new Error('the default workspace has no connected Stripe account on staging');
  console.log(`workspace ${ws.name} (${ws.slug}) on account ${account}`);

  // A fixture tier carrying the cohort date, and a fixture person.
  const { data: tier, error: tErr } = await db
    .from('membership_tier')
    .insert({
      workspace_id: ws.id,
      name: `ZZ cohort ledger rehearsal ${stamp}`,
      price_cents_year: FULL,
      currency: 'EUR',
      sort_order: 99,
      first_period_ends_on: END,
    })
    .select('id')
    .single();
  if (tErr) throw new Error(`tier: ${tErr.message}`);
  cleanup.tierId = tier.id;

  const { data: person, error: pErr } = await db
    .from('person')
    .insert({
      workspace_id: ws.id,
      first_name: 'Cohort',
      last_name: 'Rehearsal',
      email: EMAIL,
    })
    .select('id')
    .single();
  if (pErr) throw new Error(`person: ${pErr.message}`);
  cleanup.personId = person.id;

  // A customer with a card ON FILE — Stripe's test token, never a typed
  // number — so the subscription can actually charge.
  const customer = await stripe.customers.create(
    {
      email: EMAIL,
      name: 'Cohort Rehearsal',
      payment_method: 'pm_card_visa',
      invoice_settings: { default_payment_method: 'pm_card_visa' },
    },
    { stripeAccount: account },
  );
  cleanup.customers.push(customer.id);

  const recurringProduct = await stripe.products.create(
    { name: `${ws.name} membership — cohort rehearsal` },
    { stripeAccount: account },
  );
  cleanup.products.push(recurringProduct.id);
  const oneOffProduct = await stripe.products.create(
    { name: `${ws.name} membership — first period (rehearsal)` },
    { stripeAccount: account },
  );
  cleanup.products.push(oneOffProduct.id);

  // THE SHAPE: the full-price subscription starting at the anchor, with the
  // first period's money as a one-off invoice item, and the join's metadata.
  const sub = await stripe.subscriptions.create(
    {
      customer: customer.id,
      // Same limitation as the invoice item: subscriptions.create wants a
      // product id, not inline product data. Checkout accepts the inline
      // form and makes the product itself, which is why the route can.
      items: [
        {
          price_data: {
            currency: 'eur',
            product: recurringProduct.id,
            unit_amount: FULL,
            recurring: { interval: 'year' },
          },
        },
      ],
      // `add_invoice_items` will not take inline `product_data` the way a
      // Checkout line will — it wants a product id — so one is made above.
      // That difference is itself worth knowing: it is why the join route
      // uses a Checkout line rather than an invoice item.
      add_invoice_items: [
        { price_data: { currency: 'eur', product: oneOffProduct.id, unit_amount: FULL } },
      ],
      trial_end: ANCHOR,
      metadata: {
        workspace_id: ws.id,
        person_id: person.id,
        tier_id: tier.id,
        rehearsal: 'cohort-ledger',
      },
    },
    { stripeAccount: account },
  );
  cleanup.subs.push(sub.id);
  console.log(`\nsubscription ${sub.id}  status=${sub.status}  trial_end=${new Date(ANCHOR * 1000).toISOString().slice(0, 10)}`);

  // WHAT STRIPE PRODUCED.
  const invoices = await stripe.invoices.list(
    { subscription: sub.id, limit: 10 },
    { stripeAccount: account },
  );
  console.log(`\ninvoices on that subscription: ${invoices.data.length}`);
  for (const inv of invoices.data) {
    console.log(
      `  ${inv.id}  reason=${inv.billing_reason}  status=${inv.status}  total=${money(inv.total)}  paid=${money(inv.amount_paid)}`,
    );
    for (const line of inv.lines?.data ?? []) {
      console.log(`      line ${money(line.amount)}  ${line.description ?? ''}`);
    }
  }

  // Give the deployed webhook a moment, then ask the database what it made.
  console.log('\nwaiting 15s for the deployed staging webhook…');
  await new Promise((r) => setTimeout(r, 15000));

  const { data: members } = await db
    .from('membership_member')
    .select('id, status, renews_at, stripe_subscription_id')
    .eq('person_id', person.id);
  for (const m of members ?? []) cleanup.memberIds.push(m.id);
  console.log(`\nmember rows: ${(members ?? []).length}`);
  for (const m of members ?? []) {
    console.log(`  ${m.id}  status=${m.status}  renews_at=${m.renews_at}`);
  }

  const { data: purchases } = await db
    .from('purchase')
    .select('id, amount_cents, currency, status, item_label, stripe_invoice_id, billing')
    .eq('person_id', person.id);
  for (const p of purchases ?? []) cleanup.purchaseIds.push(p.id);
  console.log(`\nledger rows: ${(purchases ?? []).length}`);
  for (const p of purchases ?? []) {
    console.log(
      `  ${money(p.amount_cents)} ${p.currency}  ${p.status}  "${p.item_label}"  invoice=${p.stripe_invoice_id ?? '—'}`,
    );
  }

  console.log('\n--- the answer ---');
  const paid = invoices.data.filter((i) => i.status === 'paid');
  if (!paid.length) {
    console.log('NO PAID INVOICE: the one-off was not billed through an invoice at all.');
  } else if (!(purchases ?? []).length) {
    console.log('PAID INVOICE BUT NO LEDGER ROW: invoice.paid did not reach the ledger.');
  } else {
    const row = purchases[0];
    const inv = paid[0];
    console.log(
      `ledger row ${money(row.amount_cents)} against a paid invoice of ${money(inv.amount_paid)} — ${
        row.amount_cents === inv.amount_paid ? 'AMOUNTS AGREE' : 'AMOUNTS DISAGREE'
      }`,
    );
    console.log(`label: "${row.item_label}"`);
  }
} finally {
  console.log('\ncleaning up…');
  const { data: ws } = await db.from('workspace').select('id, stripe_account_id').eq('slug', 'default').single();
  for (const id of cleanup.subs) {
    await stripe.subscriptions.cancel(id, { stripeAccount: ws.stripe_account_id }).catch(() => {});
  }
  for (const id of cleanup.customers) {
    await stripe.customers.del(id, { stripeAccount: ws.stripe_account_id }).catch(() => {});
  }
  for (const id of cleanup.products) {
    await stripe.products.del(id, { stripeAccount: ws.stripe_account_id }).catch(() => {});
  }
  for (const id of cleanup.purchaseIds) await db.from('purchase').delete().eq('id', id);
  for (const id of cleanup.memberIds) await db.from('membership_member').delete().eq('id', id);
  if (cleanup.personId) await db.from('person').delete().eq('id', cleanup.personId);
  if (cleanup.tierId) await db.from('membership_tier').delete().eq('id', cleanup.tierId);
  console.log('cleaned up');
}
