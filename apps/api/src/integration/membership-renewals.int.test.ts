// my.thread → Purchases, P1: a member sees what renews and stops or resumes
// it — in The Fibre, not Stripe's portal. Against staging and a Stripe TEST
// subscription on the fixtures' connected account.
//
// A PERMANENT fixture workspace, not a throwaway: stopping a renewal writes an
// activity row, activity is append-only, and a workspace holding one can never
// be deleted (two throwaways were stranded on 2026-10-15 learning this).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { createFixtureUser, deleteFixtureUser, getPermanentFixtureWorkspace, service, type FixtureUser } from './staging.js';

let app: Hono;
let ws = '';
let tierId = '';
let personId = '';
let user: FixtureUser;
let account = '';
let subId = '';
let customerId = '';
let memberId = '';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' as Stripe.LatestApiVersion });

const call = (path: string, init: RequestInit = {}) =>
  app.request(`/api/v1/membership/portal${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${user.accessToken}`, 'Content-Type': 'application/json' },
  });

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
  user = await createFixtureUser(ws, 'renew');
  const { data: tier } = await service.from('membership_tier').insert({ workspace_id: ws, name: 'Singer', price_cents_year: 30000 }).select('id').single();
  tierId = tier!.id as string;
  const { data: person } = await service.from('person').insert({ workspace_id: ws, email: user.email, first_name: 'Rene' }).select('id').single();
  personId = person!.id as string;
  const customer = await stripe.customers.create({ email: user.email }, { stripeAccount: account });
  customerId = customer.id;
  const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id }, { stripeAccount: account });
  const product = await stripe.products.create({ name: 'Singer (renewal test)' }, { stripeAccount: account });
  const sub = await stripe.subscriptions.create(
    { customer: customer.id, default_payment_method: pm.id, items: [{ price_data: { currency: 'eur', product: product.id, unit_amount: 30000, recurring: { interval: 'year' } } }] },
    { stripeAccount: account },
  );
  subId = sub.id;
  const { data: m } = await service
    .from('membership_member')
    .insert({ workspace_id: ws, person_id: person!.id, tier_id: tier!.id, status: 'active', stripe_subscription_id: sub.id, stripe_customer_id: customer.id })
    .select('id')
    .single();
  memberId = m!.id as string;
}, 180_000);

afterAll(async () => {
  await stripe.subscriptions.cancel(subId, {}, { stripeAccount: account }).catch(() => undefined);
  await stripe.customers.del(customerId, { stripeAccount: account }).catch(() => undefined);
  // This run's rows only; the workspace stays. The person is soft-deleted —
  // its activity row pins it, by design.
  await service.from('membership_member').delete().eq('id', memberId);
  await service.from('membership_tier').delete().eq('id', tierId);
  await service.from('person').update({ deleted_at: new Date().toISOString() }).eq('id', personId);
  if (user) await deleteFixtureUser(user);

  // §17: ASK THE DATABASE that this run left nothing new, by id — other
  // sessions' fixtures share the permanent workspace.
  const [{ count: members }, { count: tiers }, { count: livePersons }] = await Promise.all([
    service.from('membership_member').select('id', { count: 'exact', head: true }).eq('id', memberId),
    service.from('membership_tier').select('id', { count: 'exact', head: true }).eq('id', tierId),
    service.from('person').select('id', { count: 'exact', head: true }).eq('id', personId).is('deleted_at', null),
  ]);
  const sub = await stripe.subscriptions.retrieve(subId, {}, { stripeAccount: account });
  expect({ members, tiers, livePersons, subscription: sub.status }).toEqual({ members: 0, tiers: 0, livePersons: 0, subscription: 'canceled' });
}, 180_000);

describe('renewals, managed in The Fibre', () => {
  it('lists the membership with its renewal date and Stripe’s own next-invoice figure', async () => {
    const r = await call('/me/renewals');
    expect(r.status, await r.clone().text()).toBe(200);
    const item = (await r.json()).items.find((i: { member_id: string }) => i.member_id === memberId);
    expect(item).toMatchObject({ community: 'Renewal Community', tier: 'Singer', managed_by_community: false, stops_at_period_end: false });
    expect(item.next_invoice).toMatchObject({ total: 30000, currency: 'EUR' });
    expect(Date.parse(item.renews_at)).toBeGreaterThan(Date.now());
  });

  it('stopping the renewal: active until the period ends, nothing charged now', async () => {
    const before = (await stripe.invoices.list({ subscription: subId }, { stripeAccount: account })).data.length;
    const r = await call(`/me/renewals/${memberId}`, { method: 'POST', body: JSON.stringify({ stop: true }) });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await r.json()).toMatchObject({ stops_at_period_end: true });
    const sub = await stripe.subscriptions.retrieve(subId, {}, { stripeAccount: account });
    expect(sub.cancel_at_period_end).toBe(true);
    expect(sub.status).toBe('active');
    expect((await stripe.invoices.list({ subscription: subId }, { stripeAccount: account })).data.length).toBe(before);
    const item = (await (await call('/me/renewals')).json()).items.find((i: { member_id: string }) => i.member_id === memberId);
    expect(item).toMatchObject({ stops_at_period_end: true, next_invoice: null });
  });

  it('resuming it', async () => {
    const r = await call(`/me/renewals/${memberId}`, { method: 'POST', body: JSON.stringify({ stop: false }) });
    expect(r.status).toBe(200);
    expect((await stripe.subscriptions.retrieve(subId, {}, { stripeAccount: account })).cancel_at_period_end).toBe(false);
  });

  it('nobody else can touch it', async () => {
    const other = await createFixtureUser(ws, 'renew-other');
    try {
      const r = await app.request(`/api/v1/membership/portal/me/renewals/${memberId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${other.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stop: true }),
      });
      expect(r.status).toBe(404);
    } finally {
      await deleteFixtureUser(other);
    }
  });
});
