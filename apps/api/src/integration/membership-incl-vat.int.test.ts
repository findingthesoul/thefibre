// "Price includes VAT" per tier/product (2026-10-16), against staging and
// Stripe TEST through the real routes: the entered price is what a home-rate
// buyer pays; the server derives the net once (netFromInclusive) and the one
// excl. pipeline adds the VAT. (A) for a buyer who owes no VAT: the net.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, retireParticipants, service } from './staging.js';

let app: Hono;
let ws = '';
let wsSlug = '';
let tierId = '';
let account = '';
let productId = '';
const emails: string[] = [];
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' as Stripe.LatestApiVersion });

async function join(country: string | null, extra: Record<string, unknown> = {}) {
  const email = `int-inclvat-${randomUUID().slice(0, 8)}@example.com`;
  emails.push(email);
  const r = await app.request('/api/v1/membership/public/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspace_slug: wsSlug,
      tier_id: tierId,
      interval: 'year',
      email,
      name: 'Vat Tester',
      ...(country ? { country } : {}),
      terms_accepted: true,
      request_id: `int-inclvat-${randomUUID()}`,
      ...extra,
    }),
  });
  return r;
}
async function sessionOf(res: Response) {
  const body = (await res.json()) as { url?: string };
  const id = body.url?.match(/cs_test_[A-Za-z0-9]+/)?.[0];
  expect(id, JSON.stringify(body)).toBeTruthy();
  return stripe.checkout.sessions.retrieve(id!, { expand: ['line_items.data.taxes'] }, { stripeAccount: account });
}

beforeAll(async () => {
  expect(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'), 'Stripe TEST key only').toBe(true);
  const { membershipRoutes } = await import('../routes/membership.js');
  app = new Hono();
  const v1 = new Hono();
  v1.route('/membership', membershipRoutes);
  app.route('/api/v1', v1);

  // The staging fixtures' connected TEST account — read, never hard-coded.
  const { data: donor } = await service.from('workspace').select('stripe_account_id').eq('slug', 'fixture-upcoming-choir').single();
  account = donor!.stripe_account_id as string;
  expect(account).toMatch(/^acct_/);

  ws = await createThrowawayWorkspace('inclvat');
  const { data: w } = await service.from('workspace').select('slug').eq('id', ws).single();
  wsSlug = w!.slug as string;
  const appId = (await service.from('app').select('id').eq('slug', 'membership').single()).data!.id as string;
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: appId }, { onConflict: 'workspace_id,app_id' });
  const { error: wErr } = await service
    .from('workspace')
    .update({ stripe_account_id: account, invoice_details: { legal_name: 'Incl Vat Test BV', vat_registered: true, vat_rate_pct: 21 } })
    .eq('id', ws);
  if (wErr) throw new Error(`workspace: ${wErr.message}`);
  const { data: tier, error: tErr } = await service
    .from('membership_tier')
    .insert({ workspace_id: ws, name: 'Member', price_cents_year: 36300, currency: 'EUR', price_includes_vat: true })
    .select('id')
    .single();
  if (tErr) throw new Error(`tier: ${tErr.message}`);
  tierId = tier!.id as string;
  const { data: p, error: pErr } = await service
    .from('membership_product')
    .insert({ workspace_id: ws, name: 'Incl workshop', price_cents: 12100, price_interval: 'once', purchasable: true, price_includes_vat: true })
    .select('id')
    .single();
  if (pErr) throw new Error(`product: ${pErr.message}`);
  productId = p!.id as string;
}, 120_000);

afterAll(async () => {
  if (ws) {
    await retireParticipants(ws, emails);
    await service.from('membership_product').delete().eq('workspace_id', ws);
    await service.from('membership_tier').delete().eq('workspace_id', ws);
    await service.from('workspace').update({ stripe_account_id: null }).eq('id', ws);
    await deleteThrowawayWorkspace(ws);
  }
}, 120_000);

describe('a price entered INCLUDING VAT (363.00 incl. 21%)', () => {
  it('an NL consumer pays exactly the entered price: net 300.00 + VAT 63.00 on Stripe', async () => {
    const r = await join('NL');
    expect(r.status, await r.clone().text()).toBe(200);
    const s = await sessionOf(r);
    expect(s.amount_subtotal).toBe(30000);
    expect(s.total_details?.amount_tax).toBe(6300);
    expect(s.amount_total).toBe(36300);
  });

  it('outside the EU: the net (A) — no VAT is due, so 300.00', async () => {
    const r = await join('US');
    expect(r.status).toBe(200);
    const s = await sessionOf(r);
    expect(s.amount_total).toBe(30000);
  });

  it('a discount code acts on the ENTERED price, then the net is derived (363 − 20% = 290.40 incl.)', async () => {
    const { data: code, error } = await service
      .from('discount_code')
      .insert({ workspace_id: ws, code: `INCL${Date.now().toString(36).toUpperCase()}`, type: 'percentage', discount_percentage: 20, applies_to: 'tier', applies_to_id: tierId })
      .select('id, code')
      .single();
    expect(error).toBeNull();
    try {
      // validate-code answers NET figures — the basket's lines are net.
      const v = await (
        await app.request('/api/v1/membership/public/validate-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_slug: wsSlug, tier_id: tierId, interval: 'year', code: code!.code, country: 'NL' }),
        })
      ).json();
      expect(v).toMatchObject({ valid: true, full_price_cents: 30000, price_cents: 24000 });
      // And the charge: 290.40 incl. = 240.00 net + 50.40 VAT.
      const r = await join('NL', { code: code!.code });
      expect(r.status, await r.clone().text()).toBe(200);
      const s = await sessionOf(r);
      expect(s.amount_total).toBe(29040);
    } finally {
      await service.from('discount_code').delete().eq('id', code!.id);
    }
  });

  it('a product entered incl. VAT, bought on its own: 121.00 → net 100.00 + 21.00', async () => {
    const email = `int-inclvat-buy-${randomUUID().slice(0, 8)}@example.com`;
    emails.push(email);
    const r = await app.request('/api/v1/membership/public/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_slug: wsSlug, product_id: productId, email, name: 'Incl Buyer', country: 'NL', request_id: `int-inclvat-${randomUUID()}` }),
    });
    expect(r.status, await r.clone().text()).toBe(200);
    const s = await sessionOf(r);
    expect(s.amount_subtotal).toBe(10000);
    expect(s.amount_total).toBe(12100);
  });

  it('the catalogue carries the flag (the cards show the entered price as incl.)', async () => {
    const cat = await (await app.request(`/api/v1/membership/public/catalog/${wsSlug}`)).json();
    expect(cat.tiers.find((t: { id: string }) => t.id === tierId).price_includes_vat).toBe(true);
    expect(cat.products.find((p: { id: string }) => p.id === productId).price_includes_vat).toBe(true);
  });


});
