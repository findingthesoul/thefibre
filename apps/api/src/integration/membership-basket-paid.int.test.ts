// The basket join, AFTER payment — the money and the grants (coordinator's
// review, 2026-10-16: "the post-payment gap of the basket matters").
//
// HOW A REAL PAYMENT IS DRIVEN (the stress-webhook-shapes.mjs method):
//   1. the real join route makes the real TEST Checkout session for a basket
//      (tier + the tier's recurring add-on + a standalone one-off product);
//   2. Checkout cannot be completed without a card form, so the subscription
//      Checkout would create is built from THAT session's own lines, tax
//      rates and metadata, and paid server-side with `pm_card_visa` —
//      Stripe's test payment method, no card typed anywhere;
//   3. `checkout.session.completed` (the session, now carrying that
//      subscription and customer) and `invoice.paid` (the subscription's real
//      first invoice) are delivered SIGNED to the webhook route — THIS
//      branch's code, in-process, signed with a local secret — and the
//      staging database is read back.
//
// Why in-process and not the deployed staging endpoint: this proof runs
// BEFORE the basket lands, so the deployed webhook is still the old code (and
// its secret lives only on Fly). The deployed endpoint DOES receive Stripe's
// own invoice.paid for the subscription made here; the test waits for that
// to settle first, so the row it reads is the one this code wrote.
//
// A PERMANENT fixture workspace: a paid join writes append-only activity.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { getPermanentFixtureWorkspace, service } from './staging.js';

const SECRET = 'whsec_local_basket_proof';
// BASKET_PROOF_DEPLOYED=1 — after the basket is deployed to staging: deliver
// NOTHING in-process; Stripe's own invoice.paid to the DEPLOYED endpoint is
// the whole event half, and the ledger row it writes is what is read. (No
// checkout.session.completed comes from Stripe for a subscription made this
// way, so the grant check is the in-process mode's.)
const DEPLOYED = process.env.BASKET_PROOF_DEPLOYED === '1';
process.env.STRIPE_MEMBERSHIP_WEBHOOK_SECRET = SECRET;

let app: Hono;
let ws = '';
let wsSlug = '';
let account = '';
let tierId = '';
let sheetMusic = '';
let workshop = '';
let email = '';
let personId = '';
let subId = '';
let customerId = '';
let invoice: Stripe.Invoice;
let session: Stripe.Checkout.Session;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' as Stripe.LatestApiVersion });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function deliver(type: string, object: unknown) {
  const payload = JSON.stringify({ id: `evt_local_${randomUUID().replace(/-/g, '')}`, object: 'event', type, account, data: { object } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  const r = await app.request('/api/v1/membership/stripe-webhook', {
    method: 'POST',
    headers: { 'stripe-signature': header, 'Content-Type': 'application/json' },
    body: payload,
  });
  expect(r.status, `${type}: ${await r.clone().text()}`).toBe(200);
}

beforeAll(async () => {
  expect(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'), 'Stripe TEST key only').toBe(true);
  const { membershipRoutes } = await import('../routes/membership.js');
  app = new Hono();
  const v1 = new Hono();
  v1.route('/membership', membershipRoutes);
  app.route('/api/v1', v1);

  const { data: donor } = await service.from('workspace').select('stripe_account_id').eq('slug', 'fixture-upcoming-choir').single();
  account = donor!.stripe_account_id as string;
  ws = await getPermanentFixtureWorkspace('int-basket-paid-fixtures');
  wsSlug = 'int-basket-paid-fixtures';
  const appId = (await service.from('app').select('id').eq('slug', 'membership').single()).data!.id as string;
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: appId }, { onConflict: 'workspace_id,app_id' });
  await service
    .from('workspace')
    .update({ name: 'Basket Community', stripe_account_id: account, invoice_details: { legal_name: 'Basket Test BV', vat_registered: true, vat_rate_pct: 21 } })
    .eq('id', ws);
  const { data: tier, error: tErr } = await service.from('membership_tier').insert({ workspace_id: ws, name: 'Singer', price_cents_year: 30000, currency: 'EUR', hidden: false }).select('id').single();
  if (tErr) throw new Error(`tier: ${tErr.message}`);
  tierId = tier!.id as string;
  const { data: prods, error: pErr } = await service
    .from('membership_product')
    .insert([
      { workspace_id: ws, name: 'Sheet music', price_cents: 5000, price_interval: 'year', purchasable: false },
      { workspace_id: ws, name: 'Workshop', price_cents: 2000, price_interval: 'once', purchasable: true },
    ])
    .select('id, name');
  if (pErr) throw new Error(`products: ${pErr.message}`);
  sheetMusic = prods!.find((p) => p.name === 'Sheet music')!.id as string;
  workshop = prods!.find((p) => p.name === 'Workshop')!.id as string;
  await service.from('membership_tier_product').insert({ tier_id: tierId, product_id: sheetMusic, optional: true });

  // 1. The real join → the real Checkout session.
  email = `int-basket-paid-${randomUUID().slice(0, 8)}@example.com`;
  const r = await app.request('/api/v1/membership/public/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspace_slug: wsSlug,
      tier_id: tierId,
      interval: 'year',
      email,
      name: 'Basket Payer',
      country: 'NL',
      terms_accepted: true,
      option_product_ids: [sheetMusic, workshop],
      request_id: `int-basket-paid-${randomUUID()}`,
    }),
  });
  expect(r.status, await r.clone().text()).toBe(200);
  const sid = ((await r.json()) as { url: string }).url.match(/cs_test_[A-Za-z0-9]+/)![0];
  session = await stripe.checkout.sessions.retrieve(sid, { expand: ['line_items.data.price', 'line_items.data.taxes'] }, { stripeAccount: account });
  personId = session.metadata!.person_id!;
  customerId = typeof session.customer === 'string' ? session.customer : session.customer!.id;

  // 2. The subscription Checkout would have made, from the session's own
  //    lines, paid with Stripe's test payment method.
  const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customerId }, { stripeAccount: account });
  const lines = session.line_items!.data;
  const rateOf = (l: Stripe.LineItem) => {
    const t = l.taxes?.[0] as unknown as { rate?: string | { id: string } } | undefined;
    return typeof t?.rate === 'string' ? t.rate : t?.rate?.id;
  };
  const rate = rateOf(lines[0]!);
  // Checkout's inline products are inactive outside the session, so each
  // line gets an active product of the SAME name (the name is what the
  // ledger line will say).
  const productIds = new Map<string, string>();
  for (const l of lines) productIds.set(l.id, (await stripe.products.create({ name: l.description ?? 'line' }, { stripeAccount: account })).id);
  const productOf = (l: Stripe.LineItem) => productIds.get(l.id)!;
  const sub = await stripe.subscriptions.create(
    {
      customer: customerId,
      default_payment_method: pm.id,
      ...(rate ? { default_tax_rates: [rate] } : {}),
      items: lines
        .filter((l) => l.price?.recurring)
        .map((l) => ({ price_data: { currency: l.currency, product: productOf(l), unit_amount: l.price!.unit_amount!, recurring: { interval: l.price!.recurring!.interval } } })),
      add_invoice_items: lines
        .filter((l) => !l.price?.recurring)
        .map((l) => ({ price_data: { currency: l.currency, product: productOf(l), unit_amount: l.price!.unit_amount! } })),
      metadata: {
        workspace_id: ws,
        person_id: personId,
        tier_id: tierId,
        country: 'NL',
        option_product_ids: [sheetMusic, workshop].join(','),
        vat_rule: 'excl',
        vat_rate_pct: '21',
        vat_label: 'VAT 21%',
      },
    },
    { stripeAccount: account },
  );
  subId = sub.id;
  expect(sub.status).toBe('active');
  const invId = typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice!.id!;
  invoice = await stripe.invoices.retrieve(invId, { expand: ['lines'] }, { stripeAccount: account });
  expect(invoice.status).toBe('paid');

  // Let the DEPLOYED staging webhook finish with Stripe's own invoice.paid
  // first (in DEPLOYED mode, that IS the event half).
  for (let i = 0; i < 40; i++) {
    const { data: row } = await service.from('purchase').select('billing').eq('item_ref', invId).maybeSingle();
    if (row && (!DEPLOYED || (row.billing as { lines?: unknown[] } | null)?.lines)) break;
    await sleep(1500);
  }
  await sleep(3000);

  // 3. The two events, signed, built from those real ids — in-process mode.
  if (!DEPLOYED) {
    await deliver('checkout.session.completed', { ...session, subscription: subId, customer: customerId, status: 'complete', payment_status: 'paid' });
    await deliver('invoice.paid', invoice);
  }
}, 240_000);

afterAll(async () => {
  await stripe.subscriptions.cancel(subId, {}, { stripeAccount: account }).catch(() => undefined);
  await stripe.customers.del(customerId, { stripeAccount: account }).catch(() => undefined);
  const { data: members } = await service.from('membership_member').select('id').eq('person_id', personId);
  const memberIds = (members ?? []).map((m) => m.id as string);
  if (memberIds.length) {
    await service.from('membership_member_access').delete().in('member_id', memberIds);
    await service.from('membership_reminder_send').delete().in('member_id', memberIds);
  }
  await service.from('membership_product_purchase').delete().eq('person_id', personId);
  await service.from('purchase').delete().eq('person_id', personId);
  if (memberIds.length) await service.from('membership_member').delete().in('id', memberIds);
  await service.from('membership_tier_product').delete().eq('tier_id', tierId);
  await service.from('membership_product').delete().in('id', [sheetMusic, workshop]);
  await service.from('membership_tier').delete().eq('id', tierId);
  // Soft: the join's activity pins the person.
  await service.from('person').update({ deleted_at: new Date().toISOString() }).eq('id', personId);

  // §17, by id.
  const [{ count: m }, { count: pp }, { count: led }, { count: live }] = await Promise.all([
    service.from('membership_member').select('id', { count: 'exact', head: true }).eq('person_id', personId),
    service.from('membership_product_purchase').select('id', { count: 'exact', head: true }).eq('person_id', personId),
    service.from('purchase').select('id', { count: 'exact', head: true }).eq('person_id', personId),
    service.from('person').select('id', { count: 'exact', head: true }).eq('id', personId).is('deleted_at', null),
  ]);
  expect({ m, pp, led, live }).toEqual({ m: 0, pp: 0, led: 0, live: 0 });
}, 240_000);

describe('a paid basket: tier + recurring add-on + one-off product', () => {
  it('Stripe charged what the session promised: 370.00 + 77.70 VAT', () => {
    expect(session.amount_total).toBe(44770);
    expect(invoice.amount_paid).toBe(44770);
  });

  it('the membership is active, with ONE renewal date for everything that renews', async () => {
    const { data: member } = await service.from('membership_member').select('id, status, tier_id, renews_at').eq('person_id', personId).single();
    expect(member).toMatchObject({ status: 'active', tier_id: tierId });
    const sub = await stripe.subscriptions.retrieve(subId, {}, { stripeAccount: account });
    const ends = new Set(sub.items.data.map((it) => it.current_period_end));
    expect(sub.items.data).toHaveLength(2);
    expect(ends.size).toBe(1);
    expect(Date.parse(member!.renews_at as string)).toBe([...ends][0]! * 1000);
  });

  it('ONE ledger row for the invoice, its lines matching the session', async () => {
    const { data: rows } = await service.from('purchase').select('item_ref, amount_cents, billing, status').eq('person_id', personId);
    expect(rows).toHaveLength(1);
    const row = rows![0]!;
    expect(row).toMatchObject({ item_ref: invoice.id, amount_cents: 44770, status: 'paid' });
    const b = row.billing as { subtotal_cents: number; tax_cents: number; lines: { label: string; net_cents: number; vat_cents: number; recurring: boolean }[] };
    expect(b.subtotal_cents).toBe(37000);
    expect(b.tax_cents).toBe(7770);
    const byName = Object.fromEntries(b.lines.map((l) => [l.label, l]));
    expect(b.lines).toHaveLength(3);
    expect(byName['Workshop']).toMatchObject({ net_cents: 2000, vat_cents: 420, recurring: false });
    expect(byName['Sheet music']).toMatchObject({ net_cents: 5000, vat_cents: 1050, recurring: true });
    const membershipLine = b.lines.find((l) => l.label.includes('Singer'))!;
    expect(membershipLine).toMatchObject({ net_cents: 30000, vat_cents: 6300, recurring: true });
    expect(b.lines.reduce((s, l) => s + l.net_cents, 0)).toBe(b.subtotal_cents);
  });

  it.skipIf(DEPLOYED)('a grant per product bought', async () => {
    const { data: bought } = await service.from('membership_product_purchase').select('product_id, status, stripe_session_id').eq('person_id', personId);
    expect(bought!.map((p) => p.product_id).sort()).toEqual([sheetMusic, workshop].sort());
    expect(bought!.every((p) => p.status === 'paid' && p.stripe_session_id === session.id)).toBe(true);
  });
});
