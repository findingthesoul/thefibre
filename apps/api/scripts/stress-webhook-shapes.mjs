// WHAT THE WEBHOOK RECORDS, for each shape of join.
//
//   FIBRE_ENV_FILE=…/.env.staging node apps/api/scripts/stress-webhook-shapes.mjs
//
// `stress-join-shapes.mjs` proves what Stripe will COLLECT. This proves what
// happens afterwards: the member row, the ledger row, the renewal date and
// the code redemption. They are different halves and a bug can live in either
// — a join can charge the right amount and record the wrong one.
//
// HOW IT DRIVES A REAL PAYMENT. Checkout cannot be completed without a card
// form, so each shape is built as the subscription Checkout would have
// created — the same lines, the same metadata — with `pm_card_visa`, Stripe's
// own test token, as the customer's payment method. No card number is typed
// anywhere. The deployed webhook then does the rest, and this reads what it
// wrote.
//
// WHAT IT CANNOT COVER, said plainly: the add-on GRANT rows are written from
// `checkout.session.completed`, and a subscription created directly never
// produces a checkout session. `probe-option-grants.mjs` asks the database
// about that path's one real risk instead.
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
const money = (c) => (c == null ? null : (c / 100).toFixed(2));
const END = '2026-12-31';
const ANCHOR = Math.floor(Date.parse(`${END}T00:00:00Z`) / 1000) + 86400;

/** The one workspace this script ever uses. See the comment where it is
 *  resolved: a paid join writes append-only activity, so a throwaway here
 *  could never be removed again. */
const PERMANENT_SLUG = 'int-webhook-shape-fixtures';

const made = { ws: null, slug: null, permanent: false, subs: [], customers: [], products: [], persons: [] };

/** Everything a previous run left that CAN go. Activity cannot, and the
 *  persons it pins are soft-deleted rather than removed. */
async function clearContent(ws) {
  const members = await db.from('membership_member').select('id').eq('workspace_id', ws);
  const ids = (members.data ?? []).map((m) => m.id);
  if (ids.length) await db.from('membership_reminder_send').delete().in('member_id', ids);
  const tiers = await db.from('membership_tier').select('id').eq('workspace_id', ws);
  const tierIds = (tiers.data ?? []).map((t) => t.id);
  if (tierIds.length) await db.from('membership_tier_product').delete().in('tier_id', tierIds);
  for (const table of [
    'membership_product_purchase',
    'purchase',
    'membership_member',
    'membership_product',
    'discount_code',
    'membership_tier',
  ]) {
    const r = await db.from(table).delete().eq('workspace_id', ws);
    if (r.error) console.warn(`  ${table}: ${r.error.message}`);
  }
  // Soft, because their activity pins them. A hard delete is refused and a
  // soft one is what the row is for.
  const p = await db
    .from('person')
    .update({ deleted_at: new Date().toISOString() })
    .eq('workspace_id', ws)
    .is('deleted_at', null);
  if (p.error) console.warn(`  person soft-delete: ${p.error.message}`);
}
const findings = [];
let account = null;

async function ins(table, row, what) {
  const { data, error } = await db.from(table).insert(row).select('id').single();
  if (error) throw new Error(`${what}: ${error.message}`);
  return data.id;
}

const productFor = async (name) => {
  const p = await stripe.products.create({ name }, { stripeAccount: account });
  made.products.push(p.id);
  return p.id;
};

/** One shape: build it, pay it, wait for the deployed webhook, read what it
 *  wrote, and say whether it matches.
 *
 *  `lines` are {cents, recurring, name}. `expect` says what the ledger and the
 *  member row must look like. */
async function shape({ name, tierId, lines, trialEnd, metadata = {}, expectPaid, expectRenewsDay }) {
  const email = `int-wh-${stamp}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const personId = await ins(
    'person',
    { workspace_id: made.ws, first_name: 'Webhook', last_name: 'Shape', email },
    `person ${name}`,
  );
  made.persons.push(personId);

  const customer = await stripe.customers.create(
    {
      email,
      name: 'Webhook Shape',
      payment_method: 'pm_card_visa',
      invoice_settings: { default_payment_method: 'pm_card_visa' },
    },
    { stripeAccount: account },
  );
  made.customers.push(customer.id);

  const recurring = lines.filter((l) => l.recurring);
  const oneOff = lines.filter((l) => !l.recurring);
  const sub = await stripe.subscriptions.create(
    {
      customer: customer.id,
      items: await Promise.all(
        recurring.map(async (l) => ({
          price_data: {
            currency: 'eur',
            product: await productFor(l.name),
            unit_amount: l.cents,
            recurring: { interval: l.interval ?? 'year' },
          },
        })),
      ),
      ...(oneOff.length
        ? {
            add_invoice_items: await Promise.all(
              oneOff.map(async (l) => ({
                price_data: {
                  currency: 'eur',
                  product: await productFor(l.name),
                  unit_amount: l.cents,
                },
              })),
            ),
          }
        : {}),
      ...(trialEnd ? { trial_end: trialEnd } : {}),
      metadata: { workspace_id: made.ws, person_id: personId, tier_id: tierId, ...metadata },
    },
    { stripeAccount: account },
  );
  made.subs.push(sub.id);

  // Wait for the deployed webhook, then read.
  await new Promise((r) => setTimeout(r, 18000));

  const { data: members } = await db
    .from('membership_member')
    .select('id, status, renews_at')
    .eq('person_id', personId);
  const { data: purchases } = await db
    .from('purchase')
    .select('amount_cents, status, stripe_invoice_id, discount_reason, item_label')
    .eq('person_id', personId);

  const invoices = await stripe.invoices.list({ subscription: sub.id, limit: 5 }, { stripeAccount: account });
  const paid = invoices.data.filter((i) => i.status === 'paid');

  const problems = [];
  if ((members ?? []).length !== 1) problems.push(`${(members ?? []).length} member rows, want 1`);
  else if (members[0].status !== 'active') problems.push(`member is ${members[0].status}, want active`);

  // ONE ROW PER PAID INVOICE, for exactly what it collected.
  for (const inv of paid) {
    const rows = (purchases ?? []).filter((p) => p.stripe_invoice_id === inv.id);
    if (rows.length !== 1) {
      problems.push(`invoice ${money(inv.amount_paid)} has ${rows.length} ledger rows, want 1`);
      continue;
    }
    if (rows[0].amount_cents !== inv.amount_paid) {
      problems.push(`ledger says ${money(rows[0].amount_cents)}, invoice collected ${money(inv.amount_paid)}`);
    }
    if (rows[0].status !== 'paid') problems.push(`ledger row is ${rows[0].status}, want paid`);
  }
  const orphans = (purchases ?? []).filter((p) => !paid.some((i) => i.id === p.stripe_invoice_id));
  if (orphans.length) problems.push(`${orphans.length} ledger row(s) belong to no paid invoice`);

  if (expectPaid != null) {
    const total = paid.reduce((n, i) => n + (i.amount_paid ?? 0), 0);
    if (total !== expectPaid) problems.push(`collected ${money(total)}, want ${money(expectPaid)}`);
  }
  if (expectRenewsDay && members?.[0]) {
    const day = String(members[0].renews_at ?? '').slice(0, 10);
    if (day !== expectRenewsDay) problems.push(`renews_at ${day || 'null'}, want ${expectRenewsDay}`);
  }
  // A CODE MUST BE REDEEMED ONCE. The webhook takes the use at payment
  // confirmation on the join's own invoice, guarded so a retry cannot take a
  // second — so "once" is the assertion, not "at least once".
  if (metadata.discount_code_id) {
    const { data: code } = await db
      .from('discount_code')
      .select('used_count')
      .eq('id', metadata.discount_code_id)
      .maybeSingle();
    if ((code?.used_count ?? 0) !== 1) problems.push(`code used_count is ${code?.used_count}, want 1`);
    const row = (purchases ?? [])[0];
    if (row && row.discount_reason !== 'coupon') {
      problems.push(`ledger discount_reason is ${row.discount_reason ?? 'null'}, want coupon`);
    }
  }

  findings.push({
    name,
    ok: problems.length === 0,
    detail: problems.length
      ? problems.join('; ')
      : `collected ${money(paid.reduce((n, i) => n + (i.amount_paid ?? 0), 0))}, one row each, member active` +
        (expectRenewsDay ? `, renews ${expectRenewsDay}` : ''),
  });
}

try {
  const { data: def } = await db
    .from('workspace')
    .select('stripe_account_id')
    .eq('slug', 'default')
    .single();
  account = def?.stripe_account_id;
  if (!account) throw new Error('the default workspace has no connected Stripe account');

  // ONE PERMANENT WORKSPACE, REUSED — not a throwaway per run.
  //
  // A paid join writes `activity` rows, and activity is append-only, enforced
  // by a database trigger even against the service role (hard rule 5). So a
  // workspace that has ever hosted one can NEVER be hard-deleted: the
  // activity pins the person, the person pins the workspace, and the delete
  // is refused forever.
  //
  // That is not a bug to work around, it is the rule — and it is how staging
  // came to carry 124 abandoned fixture workspaces, each walked by the
  // five-minute schedulers. The repo's own answer is a permanent fixture
  // reused per run, with CONTENT cleaned and persons soft-deleted
  // (integration/staging.ts, ENROL_FIXTURE_WS_SLUG). This does the same.
  made.slug = PERMANENT_SLUG;
  const existing = await db.from('workspace').select('id').eq('slug', made.slug).maybeSingle();
  if (existing.error) throw new Error(`fixture workspace: ${existing.error.message}`);
  made.ws =
    existing.data?.id ??
    (await ins(
      'workspace',
      {
        name: 'Webhook shape fixtures (permanent — activity is append-only)',
        slug: made.slug,
        stripe_account_id: account,
      },
      'workspace',
    ));
  made.permanent = true;
  const { data: app } = await db.from('app').select('id').eq('slug', 'membership').single();
  await db
    .from('workspace_app')
    .upsert({ workspace_id: made.ws, app_id: app.id }, { onConflict: 'workspace_id,app_id' });

  // Yesterday's rows, so each run starts from the same place.
  await clearContent(made.ws);

  const yearly = await ins(
    'membership_tier',
    { workspace_id: made.ws, name: 'ZZ yearly', price_cents_year: 30000, currency: 'EUR' },
    'tier yearly',
  );
  const monthly = await ins(
    'membership_tier',
    { workspace_id: made.ws, name: 'ZZ monthly', price_cents_month: 3000, currency: 'EUR' },
    'tier monthly',
  );
  const cohort = await ins(
    'membership_tier',
    {
      workspace_id: made.ws,
      name: 'ZZ cohort',
      price_cents_year: 30000,
      currency: 'EUR',
      first_period_ends_on: END,
    },
    'tier cohort',
  );
  const hidden = await ins(
    'membership_tier',
    { workspace_id: made.ws, name: 'ZZ hidden', price_cents_year: 15000, currency: 'EUR', hidden: true },
    'tier hidden',
  );
  const codeId = await ins(
    'discount_code',
    {
      workspace_id: made.ws,
      code: `ZZWH${stamp}`,
      type: 'percentage',
      discount_percentage: 100,
      applies_to: 'workspace',
    },
    'code',
  );

  const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  console.log(`fixture ${made.slug} on ${account}\n(each shape waits 18s for the deployed webhook)\n`);

  await shape({
    name: 'plain yearly',
    tierId: yearly,
    lines: [{ cents: 30000, recurring: true, name: 'ZZ yearly membership' }],
    expectPaid: 30000,
    expectRenewsDay: nextYear,
  });

  await shape({
    name: 'plain monthly',
    tierId: monthly,
    lines: [{ cents: 3000, recurring: true, interval: 'month', name: 'ZZ monthly membership' }],
    expectPaid: 3000,
  });

  await shape({
    name: 'hidden tier by its link',
    tierId: hidden,
    lines: [{ cents: 15000, recurring: true, name: 'ZZ hidden membership' }],
    expectPaid: 15000,
    expectRenewsDay: nextYear,
  });

  // THE 100% CODE WITH EXTRAS — the first invoice charges ONLY the extras,
  // which is the shape most likely to confuse a ledger that assumes the
  // membership is always on the invoice.
  await shape({
    name: '100% code + extras (extras only on the first invoice)',
    tierId: cohort,
    trialEnd: ANCHOR,
    lines: [
      // No tier one-off: 100% off leaves nothing to charge now.
      { cents: 30000, recurring: true, name: 'ZZ cohort membership' },
      { cents: 19320, recurring: false, name: 'ZZ Workspace — first period' },
      { cents: 19320, recurring: true, name: 'ZZ Workspace' },
      { cents: 100000, recurring: false, name: 'ZZ Accreditation' },
    ],
    metadata: { discount_code_id: codeId },
    expectPaid: 119320,
    expectRenewsDay: END === '2026-12-31' ? '2027-01-01' : null,
  });

  console.log('\nshape                                                  what the webhook recorded');
  console.log('─'.repeat(100));
  for (const f of findings) {
    console.log(`${f.ok ? 'ok  ' : 'FAIL'}  ${f.name.padEnd(50)} ${f.detail}`);
  }
  console.log('─'.repeat(100));
  const bad = findings.filter((f) => !f.ok);
  console.log(bad.length ? `${bad.length} shape(s) recorded wrongly` : 'every shape recorded correctly.');
  if (bad.length) process.exitCode = 1;
} finally {
  console.log('\ncleaning up…');
  for (const id of made.subs) {
    await stripe.subscriptions.cancel(id, {}, { stripeAccount: account }).catch(() => {});
  }
  for (const id of made.customers) {
    await stripe.customers.del(id, {}, { stripeAccount: account }).catch(() => {});
  }
  for (const id of made.products) {
    await stripe.products.del(id, {}, { stripeAccount: account }).catch(() => {});
  }
  if (made.ws) {
    // The content goes; the workspace STAYS, permanently and on purpose.
    // Trying to delete it would fail on the append-only activity every time,
    // print a warning, and leave exactly the shell this is avoiding.
    await clearContent(made.ws);
    console.log(`  ${made.slug} cleared (kept — activity is append-only)`);
  }
}
