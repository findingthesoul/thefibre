// The page basket, products only (2026-10-16): /public/buy takes several
// products in ONE Checkout — one line each, the VAT rule's rate on each —
// and the webhook gives a grant per product and ONE ledger row with its
// lines. A single product still goes as `product_id`, which is what keeps a
// page one release ahead working against an older API.
//
// Against staging and Stripe TEST, through the real route; the webhook half
// is delivered SIGNED in-process from the real session (a Checkout cannot be
// paid from a script). A PERMANENT fixture workspace: a purchase writes
// append-only activity.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { getPermanentFixtureWorkspace, service } from './staging.js';

const SECRET = 'whsec_local_basket_buy';
process.env.STRIPE_MEMBERSHIP_WEBHOOK_SECRET = SECRET;

let app: Hono;
let ws = '';
const SLUG = 'int-basket-paid-fixtures';
let account = '';
let workshop = '';
let retreat = '';
let notForSale = '';
let monthly = '';
const emails: string[] = [];
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' as Stripe.LatestApiVersion });

const buy = async (extra: Record<string, unknown>) => {
  const email = `int-basket-buy-${randomUUID().slice(0, 8)}@example.com`;
  emails.push(email);
  return app.request('/api/v1/membership/public/buy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_slug: SLUG, email, name: 'Basket Buyer', country: 'NL', request_id: `int-basket-buy-${randomUUID()}`, ...extra }),
  });
};
const sessionOf = async (r: Response) =>
  stripe.checkout.sessions.retrieve(((await r.json()) as { url: string }).url.match(/cs_test_[A-Za-z0-9]+/)![0], { expand: ['line_items.data.taxes'] }, { stripeAccount: account });

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
  const { data, error } = await service
    .from('membership_product')
    .insert([
      { workspace_id: ws, name: 'Buy workshop', price_cents: 8000, price_interval: 'once', purchasable: true },
      { workspace_id: ws, name: 'Buy retreat', price_cents: 20000, price_interval: 'once', purchasable: true },
      { workspace_id: ws, name: 'Buy not for sale', price_cents: 900, price_interval: 'once', purchasable: false },
      { workspace_id: ws, name: 'Buy monthly circle', price_cents: 1500, price_interval: 'month', purchasable: true },
    ])
    .select('id, name');
  if (error) throw new Error(`products: ${error.message}`);
  workshop = data!.find((p) => p.name === 'Buy workshop')!.id as string;
  retreat = data!.find((p) => p.name === 'Buy retreat')!.id as string;
  notForSale = data!.find((p) => p.name === 'Buy not for sale')!.id as string;
  monthly = data!.find((p) => p.name === 'Buy monthly circle')!.id as string;
}, 120_000);

afterAll(async () => {
  const { data: persons } = await service.from('person').select('id').eq('workspace_id', ws).in('email', emails);
  const ids = (persons ?? []).map((p) => p.id as string);
  if (ids.length) {
    await service.from('membership_product_purchase').delete().in('person_id', ids);
    await service.from('purchase').delete().in('person_id', ids);
    await service.from('person').update({ deleted_at: new Date().toISOString() }).in('id', ids);
  }
  await service.from('membership_product').delete().in('id', [workshop, retreat, notForSale, monthly]);
  const [{ count: pp }, { count: led }, { count: prods }] = await Promise.all([
    service.from('membership_product_purchase').select('id', { count: 'exact', head: true }).in('person_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
    service.from('purchase').select('id', { count: 'exact', head: true }).in('person_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
    service.from('membership_product').select('id', { count: 'exact', head: true }).in('id', [workshop, retreat, notForSale, monthly]),
  ]);
  expect({ pp, led, prods }).toEqual({ pp: 0, led: 0, prods: 0 });
}, 120_000);

describe('the page basket, products only', () => {
  it('a RECURRING product is refused as a one-off, alone or in a basket — the page’s rule on the server', async () => {
    for (const body of [{ product_id: monthly }, { product_ids: [workshop, monthly] }]) {
      const r = await buy(body);
      expect(r.status, await r.clone().text()).toBe(400);
      const j = (await r.json()) as { code?: string; error?: string };
      expect(j.code).toBe('recurring_needs_membership');
      expect(j.error).toContain('Buy monthly circle');
    }
    // Nothing was granted.
    const { count } = await service.from('membership_product_purchase').select('id', { count: 'exact', head: true }).eq('product_id', monthly);
    expect(count).toBe(0);
  });

  it('two products: one session, one line each, 21% VAT on each', async () => {
    const r = await buy({ product_ids: [workshop, retreat] });
    expect(r.status, await r.clone().text()).toBe(200);
    const s = await sessionOf(r);
    expect(s.mode).toBe('payment');
    expect(s.amount_subtotal).toBe(28000);
    expect(s.total_details?.amount_tax).toBe(5880);
    expect(s.line_items!.data).toHaveLength(2);
    for (const l of s.line_items!.data) expect(l.taxes?.[0]?.amount).toBe(Math.round(l.amount_subtotal * 0.21));
    expect(s.metadata?.membership_product_ids?.split(',')).toEqual([workshop, retreat]);

    // The webhook: a grant per product, ONE ledger row with its lines.
    const payload = JSON.stringify({ id: `evt_local_${randomUUID().replace(/-/g, '')}`, object: 'event', type: 'checkout.session.completed', account, data: { object: { ...s, status: 'complete', payment_status: 'paid' } } });
    const w = await app.request('/api/v1/membership/stripe-webhook', {
      method: 'POST',
      headers: { 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }), 'Content-Type': 'application/json' },
      body: payload,
    });
    expect(w.status, await w.clone().text()).toBe(200);
    const personId = s.metadata!.person_id!;
    const { data: grants } = await service.from('membership_product_purchase').select('product_id, amount_cents').eq('person_id', personId);
    expect(grants!.map((g) => g.product_id).sort()).toEqual([workshop, retreat].sort());
    const { data: rows } = await service.from('purchase').select('item_ref, amount_cents, billing').eq('person_id', personId);
    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({ item_ref: `product-${s.id}`, amount_cents: 33880 });
    const b = rows![0]!.billing as { subtotal_cents: number; tax_cents: number; lines: { label: string; net_cents: number; vat_cents: number }[] };
    expect(b).toMatchObject({ subtotal_cents: 28000, tax_cents: 5880 });
    expect(b.lines).toEqual([
      { label: 'Buy workshop', net_cents: 8000, vat_cents: 1680, recurring: false },
      { label: 'Buy retreat', net_cents: 20000, vat_cents: 4200, recurring: false },
    ]);
  });

  it('one product still goes as product_id (what an older API understands)', async () => {
    const r = await buy({ product_id: workshop });
    expect(r.status, await r.clone().text()).toBe(200);
    const s = await sessionOf(r);
    expect(s.line_items!.data).toHaveLength(1);
    expect(s.amount_total).toBe(9680);
  });

  it('a product not sold on its own refuses the WHOLE basket, never a quiet partial', async () => {
    const r = await buy({ product_ids: [workshop, notForSale] });
    expect(r.status).toBe(400);
  });

  it('both product_id and product_ids is refused', async () => {
    const r = await buy({ product_id: workshop, product_ids: [retreat] });
    expect(r.status).toBe(400);
  });
});
