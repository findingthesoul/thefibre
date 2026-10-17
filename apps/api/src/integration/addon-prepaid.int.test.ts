// A RENEWING ADD-ON ADDED WHILE THE MEMBERSHIP IS PREPAID (Sjoerd, 2026-10-17,
// choice A: "full price now, whatever the month (€200 + VAT = €242 for
// Marieke)"). Against STAGING's database and a Stripe TEST subscription in
// her shape — trialing until 1 January, 21% as the subscription's default
// rate, €300/yr — and the real preview and add functions:
//   · the preview says €242 now (incl. €42 VAT) and the renewal invoice with
//     the item on it (€605 = (300 + 200) + 21%);
//   · adding it pays ONE invoice of €242 now, writes a ledger row "… (until
//     2026-12-31)", puts the item on the subscription with nothing more
//     charged, and the 1 January invoice is €605;
//   · an ACTIVE subscription would stay pro rata (the unit test covers the
//     rule; this proves the Stripe side of the new branch).
// A purchase writes append-only activity rows, so this runs in a PERMANENT
// fixture workspace (int-addon-fixtures): its rows are removed afterwards,
// the person is soft-deleted (activity pins it), the workspace stays.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { getPermanentFixtureWorkspace, service } from './staging.js';
import { stripeOrNull } from '../lib/stripe/client.js';
import { addAddon, addonCandidates, addonNet, loadCtx, previewAddon, type Ctx } from '../lib/membership-change.js';

const tag = randomUUID().slice(0, 8);
let ws = '';
let account = '';
let personId = '';
let tierId = '';
let productId = '';
let memberId = '';
let customerId = '';
let subId = '';
let rateId = '';
const stripe = stripeOrNull()!;
const opts = () => ({ stripeAccount: account });

beforeAll(async () => {
  expect((process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_'), 'Stripe TEST key only').toBe(true);
  ws = await getPermanentFixtureWorkspace('int-addon-fixtures');
  account = (await service.from('workspace').select('stripe_account_id').eq('slug', 'fixture-upcoming-choir').single()).data!.stripe_account_id as string;
  await service.from('workspace').update({ stripe_account_id: account }).eq('id', ws);
  personId = (await service.from('person').insert({ workspace_id: ws, email: `prepaid-${tag}@example.com`, first_name: 'Prepaid' }).select('id').single()).data!.id as string;
  tierId = (await service.from('membership_tier').insert({ workspace_id: ws, name: `Community member ${tag}`, price_cents_year: 30000 }).select('id').single()).data!.id as string;
  productId = (await service.from('membership_product').insert({ workspace_id: ws, name: `Workspace email ${tag}`, price_cents: 20000, price_interval: 'year', purchasable: true, first_period_ends_on: '2026-12-31' }).select('id').single()).data!.id as string;
  const cus = await stripe.customers.create({ email: `prepaid-${tag}@example.com` }, opts());
  customerId = cus.id;
  const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customerId }, opts());
  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm.id } }, opts());
  rateId = (await stripe.taxRates.create({ display_name: 'VAT', percentage: 21, inclusive: false, country: 'NL' }, opts())).id;
  const ws_ = (await service.from('workspace').select('name').eq('id', ws).single()).data!;
  const prod = await stripe.products.create({ name: `${ws_.name} membership — Community member ${tag}` }, opts());
  const sub = await stripe.subscriptions.create(
    { customer: customerId, default_payment_method: pm.id, trial_end: Math.floor(Date.UTC(2027, 0, 1) / 1000), default_tax_rates: [rateId], items: [{ price_data: { currency: 'eur', product: prod.id, unit_amount: 30000, recurring: { interval: 'year' } } }] },
    opts(),
  );
  subId = sub.id;
  memberId = (await service.from('membership_member').insert({ workspace_id: ws, person_id: personId, tier_id: tierId, status: 'active', stripe_subscription_id: subId, stripe_customer_id: customerId }).select('id').single()).data!.id as string;
});

afterAll(async () => {
  if (subId) await stripe.subscriptions.cancel(subId, {}, opts()).catch(() => undefined);
  if (customerId) await stripe.customers.del(customerId, {}, opts()).catch(() => undefined);
  if (rateId) await stripe.taxRates.update(rateId, { active: false }, opts()).catch(() => undefined);
  await service.from('membership_product_purchase').delete().eq('product_id', productId);
  await service.from('purchase').delete().eq('person_id', personId);
  await service.from('membership_reminder_send').delete().eq('member_id', memberId);
  await service.from('membership_member').delete().eq('id', memberId);
  await service.from('membership_product').delete().eq('id', productId);
  await service.from('membership_tier').delete().eq('id', tierId);
  await service.from('person').update({ deleted_at: new Date().toISOString() }).eq('id', personId);
  await service.from('platform_setting').delete().like('key', `membership_stripe_product:${account}:product:${productId}`);
  const [g, m] = await Promise.all([
    service.from('membership_product_purchase').select('id', { count: 'exact', head: true }).eq('product_id', productId),
    service.from('membership_member').select('id', { count: 'exact', head: true }).eq('id', memberId),
  ]);
  expect({ grants: g.count, members: m.count }).toEqual({ grants: 0, members: 0 });
});

describe('prepaid membership + renewing add-on with a first-period end', () => {
  let ctx: Ctx;
  it('the preview: €242 now, and the renewal invoice with the item on it', async () => {
    const c = await loadCtx({ id: memberId, workspace_id: ws, person_id: personId, tier_id: tierId, country: null, stripe_subscription_id: subId, stripe_customer_id: customerId });
    expect('error' in c).toBe(false);
    ctx = c as Ctx;
    expect(ctx.sub.status).toBe('trialing');
    const p = (await addonCandidates(ctx.member)).find((x) => x.id === productId)!;
    expect(p.first_period_ends_on).toBe('2026-12-31');
    const q = await previewAddon(ctx, { ...p, price_cents: await addonNet(ctx.member, p) });
    expect({ now: q.due_now_cents, tax: q.tax_now_cents, then: q.then_cents, thenTax: q.then_tax_cents }).toEqual({ now: 24200, tax: 4200, then: 60500, thenTax: 10500 });
  });

  it('adding it: one paid €242 invoice now, a ledger row until 2026-12-31, the item from the renewal, €605 on 1 January', async () => {
    const before = await stripe.invoices.list({ subscription: subId, limit: 20 }, opts());
    const p = (await addonCandidates(ctx.member)).find((x) => x.id === productId)!;
    const out = await addAddon(ctx, { ...p, price_cents: await addonNet(ctx.member, p) }, async () => undefined);
    expect(out.amount_cents).toBe(24200);
    const paid = await stripe.invoices.retrieve(out.invoice_id!, {}, opts());
    expect({ status: paid.status, total: paid.total }).toEqual({ status: 'paid', total: 24200 });
    // No other invoice on the subscription since: nothing prorated.
    // Nothing more is charged now: any new invoice on the subscription is €0
    // (Stripe may record the item change during the trial as a €0 invoice;
    // the membership webhook skips a €0 change invoice — no ledger, no mail).
    const after = await stripe.invoices.list({ subscription: subId, limit: 20 }, opts());
    const fresh = after.data.filter((i) => !before.data.some((b) => b.id === i.id));
    console.log('new subscription invoices:', JSON.stringify(fresh.map((i) => ({ total: i.total, reason: i.billing_reason, status: i.status }))));
    expect(fresh.every((i) => i.total === 0)).toBe(true);
    const ledger = (await service.from('purchase').select('amount_cents, item_label, status').eq('workspace_id', ws).eq('stripe_invoice_id', paid.id!)).data ?? [];
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ amount_cents: 24200, status: 'paid' });
    expect(String(ledger[0]!.item_label)).toContain('(until 2026-12-31)');
    const grant = (await service.from('membership_product_purchase').select('status, stripe_subscription_id').eq('product_id', productId).single()).data;
    expect(grant).toEqual({ status: 'active', stripe_subscription_id: subId });
    const sub = await stripe.subscriptions.retrieve(subId, {}, opts());
    expect(sub.items.data).toHaveLength(2);
    const next = await stripe.invoices.createPreview({ customer: customerId, subscription: subId, preview_mode: 'recurring' } as Stripe.InvoiceCreatePreviewParams, opts());
    expect(next.total).toBe(60500);
  });
});
