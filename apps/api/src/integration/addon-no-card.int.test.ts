// ADDING TO A MEMBERSHIP WITHOUT A CARD THAT WORKS (2026-10-17). A member who
// paid the year by invoice has no card on file; Pay used to fail with a
// generic error and leave an OPEN invoice behind. Against STAGING with
// Stripe TEST subscriptions in Marieke's shape (trialing to 2027-01-01, 21%
// default rate, €300/yr) and a €200/yr add-on with a first-period end:
//   · no card: the preview says needs_card; adding is refused with 409
//     code needs_card BEFORE anything is created at Stripe;
//   · a card that attaches but declines every charge (Stripe's 4000…0341): adding answers 402 code
//     card_declined, nothing is added, and the invoice it made is VOIDED.
// Permanent fixture workspace (int-addon-fixtures): purchases write
// append-only activity. Rows removed, the person soft-deleted.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getPermanentFixtureWorkspace, service } from './staging.js';
import { stripeOrNull } from '../lib/stripe/client.js';
import { addAddon, addonCandidates, addonNet, loadCtx, previewAddon, type Ctx } from '../lib/membership-change.js';

const stripe = stripeOrNull()!;
const tag = randomUUID().slice(0, 8);
let ws = '';
let account = '';
let tierId = '';
let productId = '';
const made: { person: string; member: string; customer: string; sub: string }[] = [];
let rateId = '';
const opts = () => ({ stripeAccount: account });

async function memberWith(card: 'none' | 'declines'): Promise<Ctx> {
  const person = (await service.from('person').insert({ workspace_id: ws, email: `nocard-${card}-${tag}@example.com`, first_name: 'NoCard' }).select('id').single()).data!.id as string;
  const cus = await stripe.customers.create({ email: `nocard-${card}-${tag}@example.com` }, opts());
  let pm: string | undefined;
  if (card === 'declines') {
    pm = (await stripe.paymentMethods.attach('pm_card_chargeCustomerFail', { customer: cus.id }, opts())).id;
    await stripe.customers.update(cus.id, { invoice_settings: { default_payment_method: pm } }, opts());
  }
  const prod = await stripe.products.create({ name: `nocard membership ${tag}` }, opts());
  const sub = await stripe.subscriptions.create(
    { customer: cus.id, trial_end: Math.floor(Date.UTC(2027, 0, 1) / 1000), default_tax_rates: [rateId], items: [{ price_data: { currency: 'eur', product: prod.id, unit_amount: 30000, recurring: { interval: 'year' } } }] },
    opts(),
  );
  const member = (await service.from('membership_member').insert({ workspace_id: ws, person_id: person, tier_id: tierId, status: 'active', stripe_subscription_id: sub.id, stripe_customer_id: cus.id }).select('id').single()).data!.id as string;
  made.push({ person, member, customer: cus.id, sub: sub.id });
  const c = await loadCtx({ id: member, workspace_id: ws, person_id: person, tier_id: tierId, country: null, stripe_subscription_id: sub.id, stripe_customer_id: cus.id });
  if ('error' in c) throw new Error(c.error);
  return c;
}

beforeAll(async () => {
  expect((process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_'), 'Stripe TEST key only').toBe(true);
  ws = await getPermanentFixtureWorkspace('int-addon-fixtures');
  account = (await service.from('workspace').select('stripe_account_id').eq('slug', 'fixture-upcoming-choir').single()).data!.stripe_account_id as string;
  await service.from('workspace').update({ stripe_account_id: account }).eq('id', ws);
  tierId = (await service.from('membership_tier').insert({ workspace_id: ws, name: `NoCard tier ${tag}`, price_cents_year: 30000 }).select('id').single()).data!.id as string;
  productId = (await service.from('membership_product').insert({ workspace_id: ws, name: `NoCard email ${tag}`, price_cents: 20000, price_interval: 'year', purchasable: true, first_period_ends_on: '2026-12-31' }).select('id').single()).data!.id as string;
  rateId = (await stripe.taxRates.create({ display_name: 'VAT', percentage: 21, inclusive: false, country: 'NL' }, opts())).id;
});

afterAll(async () => {
  for (const m of made) {
    await stripe.subscriptions.cancel(m.sub, {}, opts()).catch(() => undefined);
    await stripe.customers.del(m.customer, {}, opts()).catch(() => undefined);
    await service.from('membership_reminder_send').delete().eq('member_id', m.member);
    await service.from('membership_member').delete().eq('id', m.member);
    await service.from('purchase').delete().eq('person_id', m.person);
    await service.from('person').update({ deleted_at: new Date().toISOString() }).eq('id', m.person);
  }
  await service.from('membership_product_purchase').delete().eq('product_id', productId);
  await service.from('membership_product').delete().eq('id', productId);
  await service.from('membership_tier').delete().eq('id', tierId);
  await service.from('platform_setting').delete().like('key', `membership_stripe_product:${account}:product:${productId}`);
  if (rateId) await stripe.taxRates.update(rateId, { active: false }, opts()).catch(() => undefined);
});

const product = async (ctx: Ctx) => {
  const p = (await addonCandidates(ctx.member)).find((x) => x.id === productId)!;
  return { ...p, price_cents: await addonNet(ctx.member, p) };
};

describe('no card on file', () => {
  it('the preview asks for a card; adding is refused before anything reaches Stripe', async () => {
    const ctx = await memberWith('none');
    const q = await previewAddon(ctx, await product(ctx));
    expect({ now: q.due_now_cents, needs_card: q.needs_card }).toEqual({ now: 24200, needs_card: true });
    const before = await stripe.invoices.list({ customer: ctx.member.stripe_customer_id, limit: 20 }, opts());
    await expect(addAddon(ctx, await product(ctx), async () => undefined)).rejects.toMatchObject({ status: 409, code: 'needs_card' });
    const after = await stripe.invoices.list({ customer: ctx.member.stripe_customer_id, limit: 20 }, opts());
    expect(after.data.length).toBe(before.data.length);
    expect((await service.from('membership_product_purchase').select('id').eq('product_id', productId)).data ?? []).toHaveLength(0);
  });
});

describe('a card that declines', () => {
  it('402 card_declined, nothing added, and the invoice it made is voided', async () => {
    const ctx = await memberWith('declines');
    const q = await previewAddon(ctx, await product(ctx));
    expect(q.needs_card).toBeUndefined();
    await expect(addAddon(ctx, await product(ctx), async () => undefined)).rejects.toMatchObject({ status: 402, code: 'card_declined' });
    const invs = await stripe.invoices.list({ customer: ctx.member.stripe_customer_id, limit: 20 }, opts());
    const oneOff = invs.data.filter((i) => i.total === 24200);
    expect(oneOff.map((i) => i.status)).toEqual(['void']);
    expect((await service.from('membership_product_purchase').select('id').eq('product_id', productId)).data ?? []).toHaveLength(0);
    const sub = await stripe.subscriptions.retrieve(ctx.sub.id, {}, opts());
    expect(sub.items.data).toHaveLength(1);
  });
});
