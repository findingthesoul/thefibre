// WILL THE RENEWAL FIND A CARD? (lib/renewal-card.ts) asked of Stripe TEST on
// staging, in Marieke's shape: a subscription trialing to 2027-01-01, charged
// automatically. No card → needed by 1 January; a card on the customer → not;
// billed by invoice (send_invoice) → not. Customers deleted afterwards.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { service } from './staging.js';
import { stripeOrNull } from '../lib/stripe/client.js';
import { renewalCardState } from '../lib/renewal-card.js';

const stripe = stripeOrNull()!;
const tag = randomUUID().slice(0, 8);
const JAN_1 = Math.floor(Date.UTC(2027, 0, 1) / 1000);
let account = '';
let product = '';
const customers: string[] = [];
const opts = () => ({ stripeAccount: account });

async function sub(card: boolean, collection: 'charge_automatically' | 'send_invoice' = 'charge_automatically') {
  const cus = await stripe.customers.create({ email: `renewal-card-${tag}@example.com` }, opts());
  customers.push(cus.id);
  if (card) {
    const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: cus.id }, opts());
    await stripe.customers.update(cus.id, { invoice_settings: { default_payment_method: pm.id } }, opts());
  }
  return stripe.subscriptions.create(
    {
      customer: cus.id,
      trial_end: JAN_1,
      collection_method: collection,
      ...(collection === 'send_invoice' ? { days_until_due: 14 } : {}),
      items: [{ price_data: { currency: 'eur', product, unit_amount: 30000, recurring: { interval: 'year' } } }],
    },
    opts(),
  );
}

beforeAll(async () => {
  expect((process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_'), 'Stripe TEST key only').toBe(true);
  account = (await service.from('workspace').select('stripe_account_id').eq('slug', 'fixture-upcoming-choir').single()).data!.stripe_account_id as string;
  product = (await stripe.products.create({ name: `renewal-card ${tag}` }, opts())).id;
});

afterAll(async () => {
  for (const c of customers) await stripe.customers.del(c, {}, opts()).catch(() => undefined);
  if (product) await stripe.products.update(product, { active: false }, opts()).catch(() => undefined);
});

describe('renewalCardState on Stripe TEST', () => {
  it('trialing, charged automatically, no card: a card is needed by 1 January', async () => {
    const s = await sub(false);
    expect(await renewalCardState(stripe, account, s.id)).toEqual({ needs_card: true, on: '2027-01-01T00:00:00.000Z' });
  });
  it('a card on the customer: nothing needed', async () => {
    const s = await sub(true);
    expect((await renewalCardState(stripe, account, s.id)).needs_card).toBe(false);
  });
  it('billed by invoice: nothing needed', async () => {
    const s = await sub(false, 'send_invoice');
    expect((await renewalCardState(stripe, account, s.id)).needs_card).toBe(false);
  });
});
