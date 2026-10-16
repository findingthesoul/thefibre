// my.thread → Purchases for a PRODUCT subscribed to on its own (2026-10-16):
// the subscriber sees it under "Your subscriptions" and stops or resumes it —
// in The Fibre, not Stripe. Against staging and a Stripe TEST subscription on
// the fixtures' connected account.
//
//   · listed with its renewal date and Stripe's own next-invoice figure;
//   · stop → cancel_at_period_end on Stripe AND on the grant; nothing charged;
//   · resume;
//   · another address gets 404 (ownership through the grants);
//   · a membership's own subscription (which carries add-on grants) is NOT
//     listed as a product subscription — that is the membership's toggle.
//
// A PERMANENT fixture workspace: a stop writes an activity row.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { createFixtureUser, deleteFixtureUser, getPermanentFixtureWorkspace, service, type FixtureUser } from './staging.js';

let app: Hono;
let ws = '';
let account = '';
let user: FixtureUser;
let stranger: FixtureUser;
let personId = '';
let productId = '';
let subId = '';
let customerId = '';
let memberSubId = '';
let memberId = '';
let tierId = '';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' as Stripe.LatestApiVersion });

const call = (who: FixtureUser, path: string, init: RequestInit = {}) =>
  app.request(`/api/v1/membership/portal${path}`, { ...init, headers: { Authorization: `Bearer ${who.accessToken}`, 'Content-Type': 'application/json' } });

beforeAll(async () => {
  expect(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'), 'Stripe TEST key only').toBe(true);
  const { membershipPurchaseRoutes } = await import('../routes/membership-purchases.js');
  app = new Hono();
  const v1 = new Hono();
  v1.route('/membership/portal', membershipPurchaseRoutes);
  app.route('/api/v1', v1);
  const { data: donor } = await service.from('workspace').select('stripe_account_id').eq('slug', 'fixture-upcoming-choir').single();
  account = donor!.stripe_account_id as string;
  ws = await getPermanentFixtureWorkspace('int-renewal-fixtures');
  await service.from('workspace').update({ stripe_account_id: account, name: 'Renewal Community' }).eq('id', ws);
  user = await createFixtureUser(ws, 'prodrenew');
  stranger = await createFixtureUser(ws, 'prodrenew-x');
  personId = (await service.from('person').insert({ workspace_id: ws, email: user.email, first_name: 'Pia' }).select('id').single()).data!.id as string;
  productId = (await service.from('membership_product').insert({ workspace_id: ws, name: 'Monthly circle', price_cents: 1500, price_interval: 'month', purchasable: true }).select('id').single()).data!.id as string;

  const customer = await stripe.customers.create({ email: user.email }, { stripeAccount: account });
  customerId = customer.id;
  const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id }, { stripeAccount: account });
  const sp = await stripe.products.create({ name: 'Monthly circle (renewal test)' }, { stripeAccount: account });
  const sub = await stripe.subscriptions.create(
    { customer: customer.id, default_payment_method: pm.id, items: [{ price_data: { currency: 'eur', product: sp.id, unit_amount: 1500, recurring: { interval: 'month' } } }] },
    { stripeAccount: account },
  );
  subId = sub.id;
  await service.from('membership_product_purchase').insert({ workspace_id: ws, person_id: personId, product_id: productId, stripe_session_id: `test-${sub.id}`, amount_cents: 1500, status: 'active', stripe_subscription_id: sub.id, stripe_customer_id: customer.id });

  // A MEMBERSHIP with a recurring add-on riding its subscription — must not
  // show up as a product subscription.
  tierId = (await service.from('membership_tier').insert({ workspace_id: ws, name: 'Prodrenew tier', price_cents_year: 30000 }).select('id').single()).data!.id as string;
  memberSubId = `sub_local_member_${Date.now()}`;
  memberId = (await service.from('membership_member').insert({ workspace_id: ws, person_id: personId, tier_id: tierId, status: 'active', stripe_subscription_id: memberSubId }).select('id').single()).data!.id as string;
  await service.from('membership_product_purchase').insert({ workspace_id: ws, person_id: personId, product_id: productId, stripe_session_id: `test-addon-${Date.now()}`, amount_cents: 1500, status: 'active', stripe_subscription_id: memberSubId });
}, 180_000);

afterAll(async () => {
  await stripe.subscriptions.cancel(subId, {}, { stripeAccount: account }).catch(() => undefined);
  await stripe.customers.del(customerId, { stripeAccount: account }).catch(() => undefined);
  await service.from('membership_product_purchase').delete().eq('person_id', personId);
  await service.from('purchase').delete().eq('person_id', personId);
  await service.from('membership_member').delete().eq('id', memberId);
  await service.from('membership_tier').delete().eq('id', tierId);
  await service.from('membership_product').delete().eq('id', productId);
  await service.from('person').update({ deleted_at: new Date().toISOString() }).eq('id', personId);
  if (user) await deleteFixtureUser(user);
  if (stranger) await deleteFixtureUser(stranger);
  const [{ count: grants }, { count: prods }, { count: members }] = await Promise.all([
    service.from('membership_product_purchase').select('id', { count: 'exact', head: true }).eq('person_id', personId),
    service.from('membership_product').select('id', { count: 'exact', head: true }).eq('id', productId),
    service.from('membership_member').select('id', { count: 'exact', head: true }).eq('id', memberId),
  ]);
  expect({ grants, prods, members }).toEqual({ grants: 0, prods: 0, members: 0 });
}, 180_000);

describe('a product subscription, managed in The Fibre', () => {
  it('listed under product_subscriptions with its renewal and Stripe’s next-invoice figure; the membership’s add-on is not', async () => {
    const r = await call(user, '/me/renewals');
    expect(r.status, await r.clone().text()).toBe(200);
    const body = await r.json();
    const subs = body.product_subscriptions as { subscription_id: string; products: string[]; next_invoice: { total: number } | null; renews_at: string; stops_at_period_end: boolean }[];
    expect(subs.map((s) => s.subscription_id)).toEqual([subId]);
    expect(subs[0]).toMatchObject({ products: ['Monthly circle'], community: 'Renewal Community', stops_at_period_end: false });
    expect(subs[0]!.next_invoice).toMatchObject({ total: 1500, currency: 'EUR' });
    expect(Date.parse(subs[0]!.renews_at)).toBeGreaterThan(Date.now());
  });

  it('stop: cancel at period end on Stripe and on the grant; nothing charged now', async () => {
    const before = (await stripe.invoices.list({ subscription: subId }, { stripeAccount: account })).data.length;
    const r = await call(user, `/me/product-renewals/${subId}`, { method: 'POST', body: JSON.stringify({ stop: true }) });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await r.json()).toMatchObject({ stops_at_period_end: true });
    const sub = await stripe.subscriptions.retrieve(subId, {}, { stripeAccount: account });
    expect(sub.cancel_at_period_end).toBe(true);
    expect(sub.status).toBe('active');
    expect((await stripe.invoices.list({ subscription: subId }, { stripeAccount: account })).data.length).toBe(before);
    const { data: g } = await service.from('membership_product_purchase').select('status, cancel_at_period_end').eq('stripe_subscription_id', subId).single();
    expect(g).toEqual({ status: 'active', cancel_at_period_end: true });
  });

  it('resume', async () => {
    const r = await call(user, `/me/product-renewals/${subId}`, { method: 'POST', body: JSON.stringify({ stop: false }) });
    expect(r.status).toBe(200);
    expect((await stripe.subscriptions.retrieve(subId, {}, { stripeAccount: account })).cancel_at_period_end).toBe(false);
  });

  it('another address cannot touch it; a membership’s own subscription is not a product subscription', async () => {
    expect((await call(stranger, `/me/product-renewals/${subId}`, { method: 'POST', body: JSON.stringify({ stop: true }) })).status).toBe(404);
    expect((await call(user, `/me/product-renewals/${memberSubId}`, { method: 'POST', body: JSON.stringify({ stop: true }) })).status).toBe(404);
    expect((await stripe.subscriptions.retrieve(subId, {}, { stripeAccount: account })).cancel_at_period_end).toBe(false);
  });
});
