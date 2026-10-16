// A RECURRING PRODUCT ON ITS OWN (2026-10-16) — POST /public/subscribe and
// its webhook side, against staging with the fixtures' Stripe TEST account.
//
//   · refused, each with a sentence: not sold on its own; nothing renews;
//     two intervals; two first-period dates;
//   · the session: mode subscription, the recurring product recurs and a
//     one-off product is a one-off line, VAT per line, the fee on the net,
//     metadata kind product_subscription; a first-period date → its first
//     period now as a one-off and full price from the trial end;
//   · the webhook (signed, in-process, a fake subscription id — none of
//     these handlers call Stripe): grants (recurring 'active' on the
//     subscription, one-off 'paid'); invoice.paid → ONE ledger row keyed by
//     the invoice and the period end; payment_failed → past_due (once);
//     subscription.deleted → cancelled + ends_at, the one-off still owned.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { getPermanentFixtureWorkspace, service } from './staging.js';

const SECRET = 'whsec_local_subscribe';
process.env.STRIPE_MEMBERSHIP_WEBHOOK_SECRET = SECRET;
const SLUG = 'int-basket-paid-fixtures';

let app: Hono;
let ws = '';
let account = '';
const ids: Record<string, string> = {};
const emails: string[] = [];
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' as Stripe.LatestApiVersion });

const subscribe = async (product_ids: string[]) => {
  const email = `int-subscribe-${randomUUID().slice(0, 8)}@example.com`;
  emails.push(email);
  return app.request('/api/v1/membership/public/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_slug: SLUG, product_ids, email, name: 'Sub Scriber', country: 'NL', request_id: `int-subscribe-${randomUUID()}` }),
  });
};
const sessionOf = async (r: Response) =>
  stripe.checkout.sessions.retrieve(((await r.json()) as { url: string }).url.match(/cs_test_[A-Za-z0-9]+/)![0], { expand: ['line_items.data.taxes', 'line_items.data.price'] }, { stripeAccount: account });
async function deliver(type: string, object: unknown) {
  const payload = JSON.stringify({ id: `evt_local_${randomUUID().replace(/-/g, '')}`, object: 'event', type, account, data: { object } });
  const r = await app.request('/api/v1/membership/stripe-webhook', {
    method: 'POST',
    headers: { 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }), 'Content-Type': 'application/json' },
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
  ws = await getPermanentFixtureWorkspace(SLUG);
  const appId = (await service.from('app').select('id').eq('slug', 'membership').single()).data!.id as string;
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: appId }, { onConflict: 'workspace_id,app_id' });
  await service.from('workspace').update({ name: 'Basket Community', stripe_account_id: account, invoice_details: { legal_name: 'Basket Test BV', vat_registered: true, vat_rate_pct: 21 } }).eq('id', ws);
  const nextYearEnd = `${new Date().getUTCFullYear() + 1}-12-31`;
  const otherDate = `${new Date().getUTCFullYear() + 1}-06-30`;
  const { data, error } = await service
    .from('membership_product')
    .insert([
      // Opened to non-members explicitly (sold_without_membership) — the
      // default since 2026-10-16 is members only.
      { workspace_id: ws, name: 'Sub monthly circle', price_cents: 1500, price_interval: 'month', purchasable: true, sold_without_membership: true },
      { workspace_id: ws, name: 'Sub kit', price_cents: 900, price_interval: 'once', purchasable: true, sold_without_membership: false },
      { workspace_id: ws, name: 'Sub yearly', price_cents: 12000, price_interval: 'year', purchasable: true, sold_without_membership: true },
      { workspace_id: ws, name: 'Sub yearly dated', price_cents: 12000, price_interval: 'year', purchasable: true, sold_without_membership: true, first_period_ends_on: nextYearEnd },
      { workspace_id: ws, name: 'Sub yearly other date', price_cents: 6000, price_interval: 'year', purchasable: true, sold_without_membership: true, first_period_ends_on: otherDate },
      { workspace_id: ws, name: 'Sub tier-only', price_cents: 500, price_interval: 'month', purchasable: false, sold_without_membership: false },
      // Purchasable and renewing but MEMBERS ONLY (the default): soul.com's
      // community email address on production.
      { workspace_id: ws, name: 'Sub members email', price_cents: 20000, price_interval: 'year', purchasable: true, sold_without_membership: false },
    ])
    .select('id, name');
  if (error) throw new Error(`products: ${error.message}`);
  for (const p of data!) ids[p.name as string] = p.id as string;
}, 120_000);

afterAll(async () => {
  const { data: persons } = await service.from('person').select('id').eq('workspace_id', ws).in('email', emails);
  const personIds = (persons ?? []).map((p) => p.id as string);
  if (personIds.length) {
    await service.from('membership_product_purchase').delete().in('person_id', personIds);
    await service.from('purchase').delete().in('person_id', personIds);
    await service.from('person').update({ deleted_at: new Date().toISOString() }).in('id', personIds);
  }
  await service.from('membership_product').delete().in('id', Object.values(ids));
  const none = ['00000000-0000-0000-0000-000000000000'];
  const [{ count: pp }, { count: led }, { count: prods }] = await Promise.all([
    service.from('membership_product_purchase').select('id', { count: 'exact', head: true }).in('person_id', personIds.length ? personIds : none),
    service.from('purchase').select('id', { count: 'exact', head: true }).in('person_id', personIds.length ? personIds : none),
    service.from('membership_product').select('id', { count: 'exact', head: true }).in('id', Object.values(ids)),
  ]);
  expect({ pp, led, prods }).toEqual({ pp: 0, led: 0, prods: 0 });
}, 120_000);

describe('refused, with a sentence', () => {
  it('a product not sold on its own', async () => {
    const r = await subscribe([ids['Sub tier-only']!]);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ code: 'not_purchasable', error: 'Sub tier-only is not sold on its own.' });
  });
  it('a members-only renewing product (the default) — refused for a non-member, with a sentence', async () => {
    const r = await subscribe([ids['Sub members email']!]);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ code: 'members_only', error: 'Sub members email is for members: it comes with a membership.' });
  });
  it('nothing that renews (that is a buy)', async () => {
    const r = await subscribe([ids['Sub kit']!]);
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe('nothing_recurring');
  });
  it('two renewal schedules in one basket', async () => {
    const r = await subscribe([ids['Sub monthly circle']!, ids['Sub yearly']!]);
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.code).toBe('mixed_intervals');
    expect(j.error).toContain('Subscribe to them one at a time');
  });
  it('two different first-period dates', async () => {
    const r = await subscribe([ids['Sub yearly dated']!, ids['Sub yearly other date']!]);
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe('mixed_first_periods');
  });
});

describe('a monthly product + a one-off: the session, then the webhook', () => {
  const SUB = `sub_local_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  let session: Stripe.Checkout.Session;
  let personId = '';

  it('one subscription session: the monthly recurs, the kit is one-off, 21% on each, fee on the net, kind product_subscription', async () => {
    const r = await subscribe([ids['Sub monthly circle']!, ids['Sub kit']!]);
    expect(r.status, await r.clone().text()).toBe(200);
    session = await sessionOf(r);
    expect(session.mode).toBe('subscription');
    expect(session.metadata).toMatchObject({ kind: 'product_subscription', workspace_id: ws });
    personId = session.metadata!.person_id!;
    const lines = session.line_items!.data;
    const byName = (n: string) => lines.find((l) => l.description === n)!;
    expect(byName('Sub monthly circle').price?.recurring?.interval).toBe('month');
    expect(byName('Sub kit').price?.recurring ?? null).toBeNull();
    for (const l of lines) expect(l.taxes?.[0]?.amount).toBe(Math.round(l.amount_subtotal * 0.21));
    expect(session.amount_subtotal).toBe(2400);
  });

  it('session completed → grants: the monthly active on the subscription, the kit paid for good', async () => {
    await deliver('checkout.session.completed', { ...session, subscription: SUB, customer: 'cus_local_x', status: 'complete', payment_status: 'paid' });
    const { data } = await service.from('membership_product_purchase').select('product_id, status, stripe_subscription_id').eq('person_id', personId);
    expect(data!.find((g) => g.product_id === ids['Sub monthly circle'])).toMatchObject({ status: 'active', stripe_subscription_id: SUB });
    // The one-off rides the subscription's key too (so either event finds it)
    // but is 'paid' — owned for good; ending the subscription leaves it.
    expect(data!.find((g) => g.product_id === ids['Sub kit'])).toMatchObject({ status: 'paid', stripe_subscription_id: SUB });
  });

  it('invoice.paid → ONE ledger row keyed by the invoice; the grant knows its period end', async () => {
    const end = Math.floor(Date.now() / 1000) + 30 * 86400;
    const inv = `in_local_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const invoice = { id: inv, object: 'invoice', amount_paid: 2904, currency: 'eur', customer: 'cus_local_x', subtotal: 2400, total_taxes: [{ amount: 504 }], lines: { data: [{ period: { end } }] }, parent: { subscription_details: { subscription: SUB, metadata: { kind: 'product_subscription', vat_rule: 'excl', vat_label: 'VAT 21%' } } } };
    await deliver('invoice.paid', invoice);
    await deliver('invoice.paid', invoice); // a retry writes nothing twice
    const { data: rows } = await service.from('purchase').select('item_ref, amount_cents, item_label').eq('person_id', personId);
    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({ item_ref: inv, amount_cents: 2904 });
    expect(rows![0]!.item_label).toContain('Sub monthly circle');
    const { data: g } = await service.from('membership_product_purchase').select('current_period_end').eq('stripe_subscription_id', SUB).eq('product_id', ids['Sub monthly circle']!).single();
    expect(new Date(g!.current_period_end as string).getTime()).toBe(end * 1000);
  });

  it('payment failed → past_due (still owned); subscription deleted → cancelled, the kit still owned', async () => {
    const failed = { id: `in_local_f${randomUUID().slice(0, 8)}`, object: 'invoice', customer: 'cus_local_x', parent: { subscription_details: { subscription: SUB, metadata: { kind: 'product_subscription' } } } };
    await deliver('invoice.payment_failed', failed);
    expect((await service.from('membership_product_purchase').select('status').eq('stripe_subscription_id', SUB).eq('product_id', ids['Sub monthly circle']!).single()).data!.status).toBe('past_due');
    await deliver('customer.subscription.deleted', { id: SUB, object: 'subscription', status: 'canceled', metadata: { kind: 'product_subscription', workspace_id: ws, person_id: personId }, items: { data: [] } });
    const { data } = await service.from('membership_product_purchase').select('product_id, status, ends_at').eq('person_id', personId);
    const monthly = data!.find((g) => g.product_id === ids['Sub monthly circle'])!;
    expect(monthly.status).toBe('cancelled');
    expect(monthly.ends_at).not.toBeNull();
    expect(data!.find((g) => g.product_id === ids['Sub kit'])!.status).toBe('paid');
  });
});

describe('a first-period date', () => {
  it('the dated yearly product: its first period now as a one-off, full price recurring from the trial end', async () => {
    const r = await subscribe([ids['Sub yearly dated']!]);
    expect(r.status, await r.clone().text()).toBe(200);
    const s = await sessionOf(r);
    const lines = s.line_items!.data;
    expect(lines).toHaveLength(2);
    expect(lines.filter((l) => l.price?.recurring?.interval === 'year')).toHaveLength(1);
    expect(lines.filter((l) => !l.price?.recurring)).toHaveLength(1);
    // The trial end rides the session's subscription_data, which Checkout
    // does not expose before payment — the split lines are the proof here.
  });
});

// EITHER EVENT FIRST, OR BOTH AT ONCE (2026-10-16): the grants converge from
// whichever lands first, and the database's unique (subscription, product)
// index makes the loser of a parallel pair find the row.
describe('the grants converge from either event', () => {
  const invoiceFor = (sub: string, personId: string) => ({
    id: `in_local_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    object: 'invoice',
    amount_paid: 2904,
    currency: 'eur',
    customer: 'cus_local_y',
    subtotal: 2400,
    total_taxes: [{ amount: 504 }],
    lines: { data: [{ period: { end: Math.floor(Date.now() / 1000) + 30 * 86400 } }] },
    parent: {
      subscription_details: {
        subscription: sub,
        metadata: { kind: 'product_subscription', workspace_id: ws, person_id: personId, product_ids: [ids['Sub monthly circle'], ids['Sub kit']].join(','), vat_rule: 'excl' },
      },
    },
  });
  const counts = async (sub: string, personId: string, inv: string) => {
    const { data: grants } = await service.from('membership_product_purchase').select('product_id').eq('stripe_subscription_id', sub);
    const { count: ledger } = await service.from('purchase').select('id', { count: 'exact', head: true }).eq('item_ref', inv).eq('person_id', personId);
    return { grants: (grants ?? []).map((g) => g.product_id as string).sort(), ledger };
  };
  const want = () => [ids['Sub monthly circle']!, ids['Sub kit']!].sort();

  it('invoice FIRST: the grants and the ledger row are written; the late session adds nothing', async () => {
    const s = await sessionOf(await subscribe([ids['Sub monthly circle']!, ids['Sub kit']!]));
    const sub = `sub_local_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const inv = invoiceFor(sub, s.metadata!.person_id!);
    await deliver('invoice.paid', inv);
    expect(await counts(sub, s.metadata!.person_id!, inv.id)).toEqual({ grants: want(), ledger: 1 });
    await deliver('checkout.session.completed', { ...s, subscription: sub, customer: 'cus_local_y', status: 'complete', payment_status: 'paid' });
    expect(await counts(sub, s.metadata!.person_id!, inv.id)).toEqual({ grants: want(), ledger: 1 });
  });

  it('session FIRST: the same result', async () => {
    const s = await sessionOf(await subscribe([ids['Sub monthly circle']!, ids['Sub kit']!]));
    const sub = `sub_local_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const inv = invoiceFor(sub, s.metadata!.person_id!);
    await deliver('checkout.session.completed', { ...s, subscription: sub, customer: 'cus_local_y', status: 'complete', payment_status: 'paid' });
    await deliver('invoice.paid', inv);
    expect(await counts(sub, s.metadata!.person_id!, inv.id)).toEqual({ grants: want(), ledger: 1 });
  });

  it('BOTH AT ONCE (parallel requests): one grant per product, one ledger row', async () => {
    const s = await sessionOf(await subscribe([ids['Sub monthly circle']!, ids['Sub kit']!]));
    const sub = `sub_local_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const inv = invoiceFor(sub, s.metadata!.person_id!);
    await Promise.all([
      deliver('checkout.session.completed', { ...s, subscription: sub, customer: 'cus_local_y', status: 'complete', payment_status: 'paid' }),
      deliver('invoice.paid', inv),
      deliver('invoice.paid', inv),
    ]);
    expect(await counts(sub, s.metadata!.person_id!, inv.id)).toEqual({ grants: want(), ledger: 1 });
  });
});

