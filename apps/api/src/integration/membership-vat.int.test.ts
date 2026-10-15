// VAT added on top of a membership join — against staging and Stripe TEST
// mode, through the real route, reading back the Checkout session Stripe made.
//
// Sjoerd, 2026-10-15: "Everything excl. VAT now." A VAT-registered community
// (soul.com is) adds VAT by the buyer's country (lib/sale-vat.ts); the rate
// rides on the line as a Stripe tax rate on the community's own account, so
// Stripe's page shows subtotal / VAT / total and charges the gross.
//   · NL consumer: 300 → 363
//   · NL business with an NL VAT number: still 363 — domestic B2B is NOT
//     reverse charge (only cross-border EU B2B is)
//   · outside the EU: 300, no tax line
//   · no country from a VAT-registered community: refused, so nobody is
//     charged a guessed rate
// (Reverse charge for a VIES-valid number abroad is pinned in the unit test —
// a live VIES answer is not something a test should depend on.)

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
const emails: string[] = [];
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' as Stripe.LatestApiVersion });

async function join(country: string | null, extra: Record<string, unknown> = {}) {
  const email = `int-vat-${randomUUID().slice(0, 8)}@example.com`;
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
      request_id: `int-vat-${randomUUID()}`,
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

  ws = await createThrowawayWorkspace('vat');
  const { data: w } = await service.from('workspace').select('slug').eq('id', ws).single();
  wsSlug = w!.slug as string;
  const appId = (await service.from('app').select('id').eq('slug', 'membership').single()).data!.id as string;
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: appId }, { onConflict: 'workspace_id,app_id' });
  const { error: wErr } = await service
    .from('workspace')
    .update({ stripe_account_id: account, invoice_details: { legal_name: 'Vat Test BV', vat_registered: true, vat_rate_pct: 21 } })
    .eq('id', ws);
  if (wErr) throw new Error(`workspace: ${wErr.message}`);
  const { data: tier, error: tErr } = await service
    .from('membership_tier')
    .insert({ workspace_id: ws, name: 'Member', price_cents_year: 30000, currency: 'EUR' })
    .select('id')
    .single();
  if (tErr) throw new Error(`tier: ${tErr.message}`);
  tierId = tier!.id as string;
}, 120_000);

afterAll(async () => {
  if (ws) {
    await retireParticipants(ws, emails);
    await service.from('membership_tier').delete().eq('workspace_id', ws);
    await service.from('workspace').update({ stripe_account_id: null }).eq('id', ws);
    await deleteThrowawayWorkspace(ws);
  }
}, 120_000);

describe('VAT on top of a membership join', () => {
  it('the catalogue says the community adds VAT, and the quote gives the rule’s rate', async () => {
    const cat = await (await app.request(`/api/v1/membership/public/catalog/${wsSlug}`)).json();
    expect(cat.vat_registered).toBe(true);
    const nl = await (await app.request(`/api/v1/membership/public/vat-quote?workspace_slug=${wsSlug}&country=NL`)).json();
    expect(nl).toMatchObject({ applies: true, rate_pct: 21, reverse_charge: false });
    const us = await (await app.request(`/api/v1/membership/public/vat-quote?workspace_slug=${wsSlug}&country=US`)).json();
    expect(us).toMatchObject({ rate_pct: 0 });
  });

  it('an NL consumer: Stripe charges 363, with a 21% VAT line on the item', async () => {
    const r = await join('NL');
    expect(r.status).toBe(200);
    const s = await sessionOf(r);
    expect(s.amount_subtotal).toBe(30000);
    expect(s.total_details?.amount_tax).toBe(6300);
    expect(s.amount_total).toBe(36300);
    expect(s.line_items?.data[0]?.taxes?.[0]?.amount).toBe(6300);
  });

  it('an NL business with an NL VAT number: domestic B2B — still 21%, not reverse charge', async () => {
    const r = await join('NL', { billing: { company: 'Bandora BV', country: 'NL', tax_no: 'NL854383402B01', payer: 'organisation' } });
    expect(r.status, await r.clone().text()).toBe(200);
    const s = await sessionOf(r);
    expect(s.amount_total).toBe(36300);
  });

  it('outside the EU: 300, no tax', async () => {
    const r = await join('US');
    expect(r.status).toBe(200);
    const s = await sessionOf(r);
    expect(s.amount_total).toBe(30000);
    expect(s.total_details?.amount_tax ?? 0).toBe(0);
  });

  it('no country: refused, so nobody is charged a guessed rate', async () => {
    const r = await join(null);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ code: 'country_required' });
  });
});
