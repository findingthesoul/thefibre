// P4: change the card in The Fibre (Sjoerd: "Manage payment should not go to
// Stripe"). Against staging and a Stripe TEST subscription on the fixtures'
// connected account. The browser's Stripe Elements step is stood in for by
// confirming the SetupIntent server-side with Stripe's own test token
// (`pm_card_mastercard`) — no card number anywhere.
//
// The PERMANENT fixture workspace of the renewal test: a card change writes
// activity, and activity is append-only.

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
let otherCustomerId = '';
let memberId = '';
let personId = '';
let tierId = '';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' as Stripe.LatestApiVersion });

const call = (path: string, body?: unknown, who: FixtureUser = user) =>
  app.request(`/api/v1/membership/portal${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${who.accessToken}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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
  user = await createFixtureUser(ws, 'card');
  const { data: tier } = await service.from('membership_tier').insert({ workspace_id: ws, name: 'Singer', price_cents_year: 30000, hidden: false }).select('id').single();
  tierId = tier!.id as string;
  const { data: person } = await service.from('person').insert({ workspace_id: ws, email: user.email, first_name: 'Cara' }).select('id').single();
  personId = person!.id as string;
  const customer = await stripe.customers.create({ email: user.email }, { stripeAccount: account });
  customerId = customer.id;
  const visa = await stripe.paymentMethods.attach('pm_card_visa', { customer: customerId }, { stripeAccount: account });
  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: visa.id } }, { stripeAccount: account });
  const product = await stripe.products.create({ name: 'Renewal Community membership — Singer' }, { stripeAccount: account });
  const sub = await stripe.subscriptions.create(
    { customer: customerId, default_payment_method: visa.id, items: [{ price_data: { currency: 'eur', product: product.id, unit_amount: 30000, recurring: { interval: 'year' } } }] },
    { stripeAccount: account },
  );
  subId = sub.id;
  const { data: m } = await service
    .from('membership_member')
    .insert({ workspace_id: ws, person_id: personId, tier_id: tierId, status: 'active', stripe_subscription_id: sub.id, stripe_customer_id: customerId })
    .select('id')
    .single();
  memberId = m!.id as string;
  otherCustomerId = (await stripe.customers.create({ email: 'someone-else@example.com' }, { stripeAccount: account })).id;
}, 180_000);

afterAll(async () => {
  await stripe.subscriptions.cancel(subId, {}, { stripeAccount: account }).catch(() => undefined);
  for (const c of [customerId, otherCustomerId]) await stripe.customers.del(c, { stripeAccount: account }).catch(() => undefined);
  await service.from('membership_member').delete().eq('id', memberId);
  await service.from('membership_tier').delete().eq('id', tierId);
  await service.from('person').update({ deleted_at: new Date().toISOString() }).eq('id', personId);
  if (user) await deleteFixtureUser(user);
  const [{ count: members }, { count: tiers }, { count: live }] = await Promise.all([
    service.from('membership_member').select('id', { count: 'exact', head: true }).eq('id', memberId),
    service.from('membership_tier').select('id', { count: 'exact', head: true }).eq('id', tierId),
    service.from('person').select('id', { count: 'exact', head: true }).eq('id', personId).is('deleted_at', null),
  ]);
  expect({ members, tiers, live }).toEqual({ members: 0, tiers: 0, live: 0 });
}, 180_000);

describe('changing the card, in The Fibre', () => {
  it('shows the card renewals are charged to', async () => {
    const r = await call(`/me/payment-method/${memberId}`);
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await r.json()).card).toMatchObject({ brand: 'visa', last4: '4242' });
  });

  it('a new card: SetupIntent on the community’s account → confirmed → default for customer AND subscription', async () => {
    const s = await call(`/me/payment-method/${memberId}/setup`, { request_id: 'req_card_change_01' });
    expect(s.status, await s.clone().text()).toBe(200);
    const setup = await s.json();
    expect(setup.client_secret).toMatch(/^seti_.*_secret_/);
    expect(setup.stripe_account).toBe(account);
    // The browser's Elements step, stood in for with Stripe's test token.
    await stripe.setupIntents.confirm(setup.setup_intent_id, { payment_method: 'pm_card_mastercard' }, { stripeAccount: account });

    const before = (await stripe.invoices.list({ subscription: subId }, { stripeAccount: account })).data.length;
    const r = await call(`/me/payment-method/${memberId}/confirm`, { setup_intent_id: setup.setup_intent_id });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await r.json()).card).toMatchObject({ brand: 'mastercard', last4: '4444' });

    const sub = await stripe.subscriptions.retrieve(subId, { expand: ['default_payment_method'] }, { stripeAccount: account });
    expect((sub.default_payment_method as Stripe.PaymentMethod).card?.last4).toBe('4444');
    const cust = (await stripe.customers.retrieve(customerId, { expand: ['invoice_settings.default_payment_method'] }, { stripeAccount: account })) as Stripe.Customer;
    expect((cust.invoice_settings.default_payment_method as Stripe.PaymentMethod).card?.last4).toBe('4444');
    expect((await stripe.invoices.list({ subscription: subId }, { stripeAccount: account })).data.length, 'nothing charged').toBe(before);
    expect(((await (await call(`/me/payment-method/${memberId}`)).json()).card).last4).toBe('4444');
  });

  it('refuses a SetupIntent that has not succeeded', async () => {
    const setup = await (await call(`/me/payment-method/${memberId}/setup`, {})).json();
    const r = await call(`/me/payment-method/${memberId}/confirm`, { setup_intent_id: setup.setup_intent_id });
    expect(r.status).toBe(409);
  });

  it('refuses a SetupIntent of another customer, even on the same account', async () => {
    const foreign = await stripe.setupIntents.create({ customer: otherCustomerId, payment_method: 'pm_card_visa', confirm: true, usage: 'off_session', automatic_payment_methods: { enabled: true, allow_redirects: 'never' } }, { stripeAccount: account });
    const r = await call(`/me/payment-method/${memberId}/confirm`, { setup_intent_id: foreign.id });
    expect(r.status).toBe(404);
  });

  it('nobody else can change it', async () => {
    const other = await createFixtureUser(ws, 'card-other');
    try {
      expect((await call(`/me/payment-method/${memberId}/setup`, {}, other)).status).toBe(404);
    } finally {
      await deleteFixtureUser(other);
    }
  });
});
