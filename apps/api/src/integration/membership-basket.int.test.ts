// The basket join (Sjoerd, 2026-10-16: "and then pay") — against staging and
// Stripe TEST, through the real join route, reading back the Checkout session
// Stripe made: a tier, the tier's recurring add-on and a product the
// community sells on its own, in ONE checkout. Recurring lines ride the
// membership's subscription (one renewal date); the one-off rides the first
// invoice; every line carries the VAT rule's rate.
//
// What happens AFTER payment (the ledger row with its lines, one grant per
// product) runs through the existing webhook paths; their pieces are pinned
// in lib/invoice-lines.test.ts and invoice-model.test.ts. A Checkout session
// cannot be paid from a script.

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
let sheetMusic = '';
let workshop = '';
let notForSale = '';
const emails: string[] = [];
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' as Stripe.LatestApiVersion });

async function join(country: string | null, extra: Record<string, unknown> = {}) {
  const email = `int-basket-${randomUUID().slice(0, 8)}@example.com`;
  emails.push(email);
  const r = await app.request('/api/v1/membership/public/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspace_slug: wsSlug,
      tier_id: tierId,
      interval: 'year',
      email,
      name: 'Basket Tester',
      ...(country ? { country } : {}),
      terms_accepted: true,
      request_id: `int-basket-${randomUUID()}`,
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

  ws = await createThrowawayWorkspace('basket');
  const { data: w } = await service.from('workspace').select('slug').eq('id', ws).single();
  wsSlug = w!.slug as string;
  const appId = (await service.from('app').select('id').eq('slug', 'membership').single()).data!.id as string;
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: appId }, { onConflict: 'workspace_id,app_id' });
  const { error: wErr } = await service
    .from('workspace')
    .update({ stripe_account_id: account, invoice_details: { legal_name: 'Basket Test BV', vat_registered: true, vat_rate_pct: 21 } })
    .eq('id', ws);
  if (wErr) throw new Error(`workspace: ${wErr.message}`);
  const { data: tier, error: tErr } = await service
    .from('membership_tier')
    .insert({ workspace_id: ws, name: 'Member', price_cents_year: 30000, currency: 'EUR' })
    .select('id')
    .single();
  if (tErr) throw new Error(`tier: ${tErr.message}`);
  tierId = tier!.id as string;
  const { data: prods, error: pErr } = await service
    .from('membership_product')
    .insert([
      { workspace_id: ws, name: 'Sheet music', price_cents: 5000, price_interval: 'year', purchasable: false },
      { workspace_id: ws, name: 'Workshop', price_cents: 2000, price_interval: 'once', purchasable: true },
      { workspace_id: ws, name: 'Not for sale', price_cents: 900, price_interval: 'once', purchasable: false },
    ])
    .select('id, name');
  if (pErr) throw new Error(`products: ${pErr.message}`);
  const id = (n: string) => prods!.find((p) => p.name === n)!.id as string;
  sheetMusic = id('Sheet music');
  workshop = id('Workshop');
  notForSale = id('Not for sale');
  // Sheet music is the tier's own optional add-on; Workshop is sold on its own.
  await service.from('membership_tier_product').insert({ tier_id: tierId, product_id: sheetMusic, optional: true });
}, 120_000);

afterAll(async () => {
  if (ws) {
    await retireParticipants(ws, emails);
    await service.from('membership_tier_product').delete().eq('tier_id', tierId);
    await service.from('membership_product').delete().eq('workspace_id', ws);
    await service.from('membership_tier').delete().eq('workspace_id', ws);
    await service.from('workspace').update({ stripe_account_id: null }).eq('id', ws);
    await deleteThrowawayWorkspace(ws);
  }
}, 120_000);

describe('the basket join: a tier, a recurring add-on and a one-off product, one checkout', () => {
  it('Stripe’s session carries all three lines, each with 21% VAT, and the right total', async () => {
    const r = await join('NL', { option_product_ids: [sheetMusic, workshop] });
    expect(r.status, await r.clone().text()).toBe(200);
    const s = await stripe.checkout.sessions.retrieve(
      ((await r.json()) as { url: string }).url.match(/cs_test_[A-Za-z0-9]+/)![0],
      { expand: ['line_items.data.taxes', 'line_items.data.price'] },
      { stripeAccount: account },
    );
    expect(s.mode).toBe('subscription');
    expect(s.amount_subtotal).toBe(37000);
    expect(s.total_details?.amount_tax).toBe(7770);
    expect(s.amount_total).toBe(44770);
    const lines = s.line_items!.data.map((l) => ({
      name: l.description,
      net: l.amount_subtotal,
      vat: l.taxes?.[0]?.amount ?? 0,
      recurring: l.price?.recurring?.interval ?? null,
    }));
    // Every line taxed at the rule's rate.
    for (const l of lines) expect(l.vat, l.name ?? '').toBe(Math.round(l.net * 0.21));
    // The two recurring lines renew together (one subscription, one interval);
    // the workshop is paid once on the first invoice.
    expect(lines.filter((l) => l.recurring).map((l) => l.recurring)).toEqual(['year', 'year']);
    expect(lines.find((l) => l.name?.includes('Workshop'))?.recurring ?? null).toBeNull();
    expect(lines.reduce((sum, l) => sum + l.net, 0)).toBe(37000);
    // What the webhook will turn into one grant per product.
    expect((s.metadata?.option_product_ids ?? '').split(',').sort()).toEqual([sheetMusic, workshop].sort());
  });

  it('a product the community does not sell on its own is refused, not quietly charged', async () => {
    const r = await join('NL', { option_product_ids: [notForSale] });
    expect(r.status).toBe(400);
  });

  it('the catalogue offers the purchasable product beside the tier’s add-on', async () => {
    const cat = await (await app.request(`/api/v1/membership/public/catalog/${wsSlug}`)).json();
    const tier = cat.tiers.find((t: { id: string }) => t.id === tierId);
    expect(tier.optional_product_ids).toEqual([sheetMusic]);
    expect(cat.products.find((p: { id: string }) => p.id === workshop)).toMatchObject({ purchasable: true });
  });
});
