// A COHORT JOIN WITH EXTRAS, through the DEPLOYED webhook: what reaches the
// ledger now, and what reaches it at the anchor?
//
//   FIBRE_ENV_FILE=…/.env.staging node apps/api/scripts/rehearse-extras-ledger.mjs
//
// THE QUESTION. Since 2026-10-14 a recurring extra is SPLIT like the tier: a
// one-off line for the first period and a recurring line from the anchor. So
// the first invoice of Sjoerd's own basket now carries SEVEN lines instead of
// four, two pairs of which share a name. Three things could go wrong, and
// `rehearse-cohort-extras.mjs` cannot see any of them because it stops at
// what Stripe says it will collect:
//
//   (a) the ledger row's amount is not the invoice's amount_paid — dropped
//       lines, or a line counted twice;
//   (b) the renewal collected at the anchor is not the figure the panel
//       promised for it.
//
// It does NOT cover the add-on GRANT rows. Those are written from
// `checkout.session.completed`, and a subscription created directly never
// produces a session — `probe-option-grants.mjs` asks the database about that
// path's one real risk instead (whether the idempotency key is the session
// alone, which would swallow every extra after the first).
//
// WHY THIS SHAPE. Checkout's subscription mode folds one-time line items into
// the subscription's first invoice, so this builds that directly, exactly as
// rehearse-cohort-ledger does. No card is typed anywhere — `pm_card_visa` is
// Stripe's own test token.
//
// AND IT DOES NOT WAIT UNTIL JANUARY. After measuring the first invoice it
// ends the trial with `trial_end: 'now'`, which is what the anchor does when
// it arrives: Stripe issues the subscription_cycle invoice there and then.
// The renewal figure is measured, not predicted.
//
// Fixtures on the STAGING connected account, two test-mode charges, all of it
// removed at the end.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
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
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes('lukhyylwhhjyihqtghvw')) throw new Error('refusing: not the staging project');

const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const stamp = Date.now();
const EMAIL = `int-extras-ledger-${stamp}@example.com`;
const END = '2026-12-31';
const ANCHOR = Math.floor(Date.parse(`${END}T00:00:00Z`) / 1000) + 86400;
const money = (c) => (c == null ? null : (c / 100).toFixed(2));

// Sjoerd's own production basket.
const TIER = 30000;
const EXTRAS = [
  { name: 'email@soul.com / Google Workspace', cents: 19320, recurs: true },
  { name: 'Fellowship', cents: 200000, recurs: true },
  { name: 'Accreditation program', cents: 100000, recurs: false },
];
const NOW_TOTAL = TIER + EXTRAS.reduce((n, x) => n + x.cents, 0); // 3,493.20
const ANCHOR_TOTAL = TIER + EXTRAS.filter((x) => x.recurs).reduce((n, x) => n + x.cents, 0); // 2,493.20

const cleanup = { subs: [], customers: [], products: [], tierId: null, personId: null, memberIds: [], purchaseIds: [] };
let account = null;
const problems = [];

try {
  const { data: ws } = await db
    .from('workspace')
    .select('id, name, slug, stripe_account_id')
    .eq('slug', 'default')
    .single();
  account = ws.stripe_account_id;
  if (!account) throw new Error('the default workspace has no connected Stripe account on staging');
  console.log(`workspace ${ws.name} (${ws.slug}) on account ${account}`);
  console.log(`the basket: ${money(NOW_TOTAL)} now, ${money(ANCHOR_TOTAL)} at the anchor\n`);

  const { data: tier, error: tErr } = await db
    .from('membership_tier')
    .insert({
      workspace_id: ws.id,
      name: `ZZ extras ledger rehearsal ${stamp}`,
      price_cents_year: TIER,
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
    .insert({ workspace_id: ws.id, first_name: 'Extras', last_name: 'Rehearsal', email: EMAIL })
    .select('id')
    .single();
  if (pErr) throw new Error(`person: ${pErr.message}`);
  cleanup.personId = person.id;

  const customer = await stripe.customers.create(
    {
      email: EMAIL,
      name: 'Extras Rehearsal',
      payment_method: 'pm_card_visa',
      invoice_settings: { default_payment_method: 'pm_card_visa' },
    },
    { stripeAccount: account },
  );
  cleanup.customers.push(customer.id);

  // `subscriptions.create` and `add_invoice_items` both want a product id,
  // where a Checkout line takes inline product_data — so each line needs a
  // product made for it. The DUPLICATE NAMES are the point: the split gives
  // "Fellowship" a one-off line and a recurring line, and this reproduces
  // that rather than disambiguating it.
  const productFor = async (name) => {
    const p = await stripe.products.create({ name }, { stripeAccount: account });
    cleanup.products.push(p.id);
    return p.id;
  };

  const recurringItems = [
    { product: await productFor(`${ws.name} membership`), cents: TIER },
  ];
  const oneOffItems = [
    { product: await productFor(`${ws.name} membership — first period`), cents: TIER },
  ];
  for (const x of EXTRAS) {
    if (x.recurs) {
      // THE SPLIT: first period now, full price from the anchor, same name.
      oneOffItems.push({ product: await productFor(`${x.name} — first period`), cents: x.cents });
      recurringItems.push({ product: await productFor(x.name), cents: x.cents });
    } else {
      oneOffItems.push({ product: await productFor(x.name), cents: x.cents });
    }
  }

  const sub = await stripe.subscriptions.create(
    {
      customer: customer.id,
      items: recurringItems.map((i) => ({
        price_data: {
          currency: 'eur',
          product: i.product,
          unit_amount: i.cents,
          recurring: { interval: 'year' },
        },
      })),
      add_invoice_items: oneOffItems.map((i) => ({
        price_data: { currency: 'eur', product: i.product, unit_amount: i.cents },
      })),
      trial_end: ANCHOR,
      metadata: {
        workspace_id: ws.id,
        person_id: person.id,
        tier_id: tier.id,
        rehearsal: 'extras-ledger',
      },
    },
    { stripeAccount: account },
  );
  cleanup.subs.push(sub.id);
  console.log(`subscription ${sub.id}  status=${sub.status}`);

  const show = async (what) => {
    const invoices = await stripe.invoices.list(
      { subscription: sub.id, limit: 20 },
      { stripeAccount: account },
    );
    console.log(`\n${what}: ${invoices.data.length} invoice(s)`);
    for (const inv of invoices.data) {
      console.log(
        `  ${inv.id}  reason=${inv.billing_reason}  status=${inv.status}  total=${money(inv.total)}  paid=${money(inv.amount_paid)}  lines=${inv.lines?.data?.length ?? 0}`,
      );
      for (const line of inv.lines?.data ?? []) {
        console.log(`      ${money(line.amount).padStart(9)}  ${line.description ?? ''}`);
      }
    }
    return invoices.data;
  };

  const first = await show('AT THE JOIN');
  const joinInvoice = first.find((i) => i.billing_reason === 'subscription_create');
  if (!joinInvoice) problems.push('no subscription_create invoice at all');
  else if (joinInvoice.amount_paid !== NOW_TOTAL) {
    problems.push(
      `the join invoice collected ${money(joinInvoice.amount_paid)}, not ${money(NOW_TOTAL)}`,
    );
  }

  // THE ANCHOR, BROUGHT FORWARD. Ending the trial is exactly what 1 January
  // does — Stripe bills the cycle immediately.
  console.log('\nending the trial, which is what the anchor does…');
  await stripe.subscriptions.update(sub.id, { trial_end: 'now' }, { stripeAccount: account });
  await new Promise((r) => setTimeout(r, 8000));
  const after = await show('AT THE ANCHOR');
  // THE AMOUNT is the question here. Not the billing_reason: ending a trial
  // early is an UPDATE to the subscription, so Stripe names this invoice
  // `subscription_update`, and at a real anchor — a trial expiring because
  // the date arrived — it names it `subscription_cycle`. Asserting the reason
  // from this shape would be asserting an artefact of the shortcut. That
  // question has its own probe, on a test clock, where the date really does
  // arrive: `probe-anchor-billing-reason.mjs`.
  const anchorInvoice = after.find((i) => i.id !== joinInvoice?.id);
  if (!anchorInvoice) problems.push('the anchor produced no invoice at all');
  else if (anchorInvoice.total !== ANCHOR_TOTAL) {
    problems.push(`the renewal invoice is ${money(anchorInvoice.total)}, not ${money(ANCHOR_TOTAL)}`);
  }

  console.log('\nwaiting 20s for the deployed staging webhook…');
  await new Promise((r) => setTimeout(r, 20000));

  const { data: members } = await db
    .from('membership_member')
    .select('id, status, renews_at')
    .eq('person_id', person.id);
  for (const m of members ?? []) cleanup.memberIds.push(m.id);
  console.log(`\nmember rows: ${(members ?? []).length}`);
  for (const m of members ?? []) console.log(`  status=${m.status}  renews_at=${m.renews_at}`);

  const { data: purchases } = await db
    .from('purchase')
    .select('id, amount_cents, currency, status, item_label, stripe_invoice_id')
    .eq('person_id', person.id)
    .order('amount_cents', { ascending: false });
  for (const p of purchases ?? []) cleanup.purchaseIds.push(p.id);
  console.log(`\nledger rows: ${(purchases ?? []).length}`);
  for (const p of purchases ?? []) {
    console.log(
      `  ${money(p.amount_cents).padStart(9)} ${p.currency}  ${p.status}  "${p.item_label}"  invoice=${p.stripe_invoice_id ?? '—'}`,
    );
  }

  // EVERY PAID INVOICE GETS EXACTLY ONE ROW, FOR WHAT IT COLLECTED. Keyed on
  // the invoice id, so this also says whether anything was double-written.
  const paid = [...first, ...after].filter((i) => i.status === 'paid');
  const seen = new Map();
  for (const inv of paid) seen.set(inv.id, inv);
  for (const inv of seen.values()) {
    const rows = (purchases ?? []).filter((p) => p.stripe_invoice_id === inv.id);
    if (rows.length !== 1) {
      problems.push(
        `invoice ${inv.id} (${inv.billing_reason}, ${money(inv.amount_paid)}) has ${rows.length} ledger rows, not 1`,
      );
      continue;
    }
    if (rows[0].amount_cents !== inv.amount_paid) {
      problems.push(
        `invoice ${inv.id} collected ${money(inv.amount_paid)} but its ledger row says ${money(rows[0].amount_cents)}`,
      );
    }
  }
  const extraRows = (purchases ?? []).filter((p) => !seen.has(p.stripe_invoice_id));
  if (extraRows.length) {
    problems.push(`${extraRows.length} ledger row(s) belong to no paid invoice`);
  }

  console.log('\n--- the answer ---');
  if (!problems.length) {
    console.log('The seven-line join invoice reaches the ledger whole, once, for what it');
    console.log('collected, and the anchor renews at the figure the panel promised — also');
    console.log('as exactly one row. (What Stripe CALLS the anchor invoice: see');
    console.log('probe-anchor-billing-reason.mjs.)');
  } else {
    console.log('PROBLEMS:');
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
  }
} finally {
  console.log('\ncleaning up…');
  for (const id of cleanup.subs) {
    await stripe.subscriptions.cancel(id, { stripeAccount: account }).catch(() => {});
  }
  for (const id of cleanup.customers) {
    await stripe.customers.del(id, { stripeAccount: account }).catch(() => {});
  }
  for (const id of cleanup.products) {
    await stripe.products.del(id, { stripeAccount: account }).catch(() => {});
  }
  for (const id of cleanup.purchaseIds) await db.from('purchase').delete().eq('id', id);
  for (const id of cleanup.memberIds) await db.from('membership_member').delete().eq('id', id);
  if (cleanup.personId) await db.from('person').delete().eq('id', cleanup.personId);
  if (cleanup.tierId) await db.from('membership_tier').delete().eq('id', cleanup.tierId);
  console.log('cleaned up');
}
