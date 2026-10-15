// Billing details kept in The Fibre (Purchases, P2) — against staging and a
// Stripe TEST subscription on the fixtures' connected account.
//
// Saved in identity_billing.buyer_details; told TO the Stripe customer; and a
// new country re-decides the VAT of a running membership from its next
// invoice (US → out of scope, no tax; back to NL → 21%). Runs in a PERMANENT
// fixture workspace (testing-approach §17) and asks the database at the end
// that it left nothing.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { createFixtureUser, deleteFixtureUser, getPermanentFixtureWorkspace, service, type FixtureUser } from './staging.js';

let app: Hono;
let ws = '';
let user: FixtureUser;
let account = '';
let subId = '';
let customerId = '';
let memberId = '';
let tierId = '';
let personId = '';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' as Stripe.LatestApiVersion });

const put = (body: unknown) =>
  app.request('/api/v1/membership/portal/me/billing-details', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${user.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const nextInvoice = async () => {
  const p = await stripe.invoices.createPreview({ subscription: subId }, { stripeAccount: account });
  return { total: p.total, tax: (p.total_taxes ?? []).reduce((s, t) => s + t.amount, 0) };
};

beforeAll(async () => {
  expect(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'), 'Stripe TEST key only').toBe(true);
  const { membershipPurchaseRoutes } = await import('../routes/membership-purchases.js');
  const { connectedTaxRateId } = await import('../lib/vat-stripe.js');
  app = new Hono();
  const v1 = new Hono();
  v1.route('/membership/portal', membershipPurchaseRoutes);
  app.route('/api/v1', v1);

  const { data: donor } = await service.from('workspace').select('stripe_account_id').eq('slug', 'fixture-upcoming-choir').single();
  account = donor!.stripe_account_id as string;
  ws = await getPermanentFixtureWorkspace('int-buyer-fixtures');
  await service
    .from('workspace')
    .update({ stripe_account_id: account, name: 'Buyer Community', invoice_details: { legal_name: 'Buyer Community BV', vat_registered: true, vat_rate_pct: 21 } })
    .eq('id', ws);
  user = await createFixtureUser(ws, 'buyer');
  tierId = (await service.from('membership_tier').insert({ workspace_id: ws, name: 'Member', price_cents_year: 30000 }).select('id').single()).data!.id as string;
  personId = (await service.from('person').insert({ workspace_id: ws, email: user.email, first_name: 'Bea' }).select('id').single()).data!.id as string;
  const customer = await stripe.customers.create({ email: user.email, address: { country: 'NL' } }, { stripeAccount: account });
  customerId = customer.id;
  const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id }, { stripeAccount: account });
  const product = await stripe.products.create({ name: 'Member (buyer test)' }, { stripeAccount: account });
  const nl = await connectedTaxRateId(account, 'NL', 21);
  const sub = await stripe.subscriptions.create(
    {
      customer: customer.id,
      default_payment_method: pm.id,
      default_tax_rates: [nl!],
      items: [{ price_data: { currency: 'eur', product: product.id, unit_amount: 30000, recurring: { interval: 'year' } } }],
      metadata: { vat_rule: 'excl', vat_rate_pct: '21', vat_label: 'VAT 21%' },
    },
    { stripeAccount: account },
  );
  subId = sub.id;
  memberId = (
    await service
      .from('membership_member')
      .insert({ workspace_id: ws, person_id: personId, tier_id: tierId, status: 'active', stripe_subscription_id: sub.id, stripe_customer_id: customer.id })
      .select('id')
      .single()
  ).data!.id as string;
}, 180_000);

afterAll(async () => {
  await stripe.subscriptions.cancel(subId, {}, { stripeAccount: account }).catch(() => undefined);
  await stripe.customers.del(customerId, { stripeAccount: account }).catch(() => undefined);
  await service.from('membership_member').delete().eq('id', memberId);
  await service.from('membership_tier').delete().eq('id', tierId);
  await service.from('person').update({ deleted_at: new Date().toISOString() }).eq('id', personId);
  await service.from('identity_billing').delete().eq('email', user.email);
  if (user) await deleteFixtureUser(user);
  const [{ count: members }, { count: billing }] = await Promise.all([
    service.from('membership_member').select('id', { count: 'exact', head: true }).eq('id', memberId),
    service.from('identity_billing').select('email', { count: 'exact', head: true }).eq('email', user.email),
  ]);
  expect({ members, billing }).toEqual({ members: 0, billing: 0 });
}, 180_000);

describe('billing details, kept in The Fibre', () => {
  it('saved here, and told to the Stripe customer', async () => {
    const r = await put({ name: 'Bea Buyer', company: 'Bandora BV', address: 'Street 1', postal_code: '1000 AA', city: 'Amsterdam', country: 'NL', tax_no: 'NL854383402B01' });
    expect(r.status, await r.clone().text()).toBe(200);
    const { data } = await service.from('identity_billing').select('buyer_details').eq('email', user.email).single();
    expect(data!.buyer_details).toMatchObject({ company: 'Bandora BV', country: 'NL', tax_no: 'NL854383402B01' });
    const cust = (await stripe.customers.retrieve(customerId, {}, { stripeAccount: account })) as Stripe.Customer;
    expect(cust.name).toBe('Bandora BV');
    expect(cust.address).toMatchObject({ line1: 'Street 1', city: 'Amsterdam', country: 'NL' });
  });

  it('moving outside the EU takes the VAT off the NEXT invoice — nothing charged now', async () => {
    const invoicesBefore = (await stripe.invoices.list({ subscription: subId }, { stripeAccount: account })).data.length;
    expect(await nextInvoice()).toEqual({ total: 36300, tax: 6300 });
    const r = await put({ name: 'Bea Buyer', address: '1 Main St', city: 'Boston', country: 'US' });
    expect(r.status).toBe(200);
    expect((await r.json()).subscriptions[0]).toMatchObject({ community: 'Buyer Community', updated: true, vat: 'VAT out of scope (outside the EU)' });
    expect(await nextInvoice()).toEqual({ total: 30000, tax: 0 });
    expect((await stripe.invoices.list({ subscription: subId }, { stripeAccount: account })).data.length).toBe(invoicesBefore);
  });

  it('back in NL: 21% again', async () => {
    await put({ name: 'Bea Buyer', address: 'Street 1', city: 'Amsterdam', country: 'NL' });
    expect(await nextInvoice()).toEqual({ total: 36300, tax: 6300 });
  });
});
