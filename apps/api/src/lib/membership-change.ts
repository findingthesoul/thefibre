// Adding to a membership, and changing it — my.thread → Purchases, P3.
//
// Sjoerd, 2026-10-15: an existing member adds an add-on of their tier, or
// moves to another tier, in The Fibre — "one subscription and one renewal
// date". Everything prices through the join's own functions (the tier's price
// logic for the member's country and interval, the product's flat price) and
// Stripe computes the proration on the subscription that already exists, so
// the PREVIEW and the CHARGE are the same Stripe computation and cannot
// disagree. VAT rides on the subscription's own tax rate (set by the join or
// by apply-vat-to-subscriptions); a one-off add-on gets the same rate.
//
// A downgrade's difference is, by default, a CREDIT on the next invoice
// (Stripe's proration credit). DOWNGRADE_REFUNDS turns it into a refund now —
// one switch, pending Sjoerd's answer (coordinator, 2026-10-15).

import type Stripe from 'stripe';
import { adminClient } from '../db.js';
import { stripeOrNull } from './stripe/client.js';
import { workspaceStripeAccount } from './payment-accounts.js';
import { priceLogicFor } from './pricing.js';
import { applyPct, evaluatePriceLogic } from '@thefibre/shared/price-logic';
import { recordPurchase } from './purchases.js';
import { chargeNet } from './sale-vat.js';
import { vatBreakdownFromInvoice } from '../routes/membership.js';
import { grantStatusFor, isRecurringInterval, LIVE_PURCHASE_STATUSES } from './product-ownership.js';

/** The pending decision: false = a downgrade's difference is credited on the
 *  next invoice (recommended); true = refunded now. */
export const DOWNGRADE_REFUNDS = false;

export type OwnedMember = {
  id: string;
  workspace_id: string;
  person_id: string;
  tier_id: string;
  country: string | null;
  stripe_subscription_id: string;
  stripe_customer_id: string;
};

export type Ctx = {
  stripe: Stripe;
  account: string;
  member: OwnedMember;
  sub: Stripe.Subscription;
  interval: 'year' | 'month';
  /** The subscription item that IS the membership (the tier's line). */
  mainItem: Stripe.SubscriptionItem;
  currency: string;
  workspaceName: string;
};

/** Everything a change needs, or a sentence why it cannot happen. */
export async function loadCtx(member: OwnedMember): Promise<Ctx | { error: string; status: number }> {
  const stripe = stripeOrNull();
  if (!stripe) return { error: 'payments are not configured', status: 503 };
  const account = await workspaceStripeAccount(member.workspace_id);
  if (!account) return { error: 'This community has not connected a payment account yet.', status: 409 };
  const sub = await stripe.subscriptions.retrieve(
    member.stripe_subscription_id,
    { expand: ['items.data.price.product'] },
    { stripeAccount: account },
  );
  if (sub.status !== 'active' && sub.status !== 'trialing') {
    return { error: 'This membership is not active, so it cannot be changed here.', status: 409 };
  }
  if (sub.cancel_at_period_end) {
    return { error: 'This membership stops at the end of its period. Resume the renewal first to change it.', status: 409 };
  }
  const { data: ws } = await adminClient.from('workspace').select('name').eq('id', member.workspace_id).maybeSingle();
  const workspaceName = (ws?.name as string | undefined) ?? '';
  // The membership's own line: the product the join named "<ws> membership —
  // <tier>". Matched on that prefix; failing that, the largest recurring item.
  const recurring = sub.items.data.filter((it) => it.price.recurring);
  const named = recurring.find((it) => {
    const p = it.price.product as Stripe.Product | string;
    return typeof p !== 'string' && !p.deleted && p.name?.startsWith(`${workspaceName} membership`);
  });
  const mainItem = named ?? [...recurring].sort((a, b) => (b.price.unit_amount ?? 0) - (a.price.unit_amount ?? 0))[0];
  if (!mainItem) return { error: 'This membership has no renewing line to change.', status: 409 };
  return {
    stripe,
    account,
    member,
    sub,
    interval: mainItem.price.recurring?.interval === 'month' ? 'month' : 'year',
    mainItem,
    currency: mainItem.price.currency,
    workspaceName,
  };
}

/** A Stripe product on the community's account for one of our products or
 *  tiers, created once (subscription items need a product id). */
async function stripeProductFor(ctx: Ctx, key: string, name: string): Promise<string> {
  // ONE ROW PER MAPPING (platform_setting key per account × product/tier),
  // claimed by INSERT: two first-time requests at once both create a Stripe
  // product, the second insert loses on the key and uses the winner's id.
  // The loser's Stripe product is orphaned, unused and harmless; no mapping
  // is ever overwritten (a shared map read-modify-written could lose one).
  const settingKey = `membership_stripe_product:${ctx.account}:${key}`;
  const read = async () =>
    ((await adminClient.from('platform_setting').select('value').eq('key', settingKey).maybeSingle()).data?.value as string | undefined) ?? null;
  const known = await read();
  if (known) return known;
  const p = await ctx.stripe.products.create({ name }, { stripeAccount: ctx.account });
  const { error } = await adminClient.from('platform_setting').insert({ key: settingKey, value: p.id, updated_at: new Date().toISOString() });
  if (error) {
    const winner = await read();
    if (winner) return winner;
    throw new Error(`product mapping: ${error.message}`);
  }
  return p.id;
}

/** DOUBLE-SUBMIT GUARD. A double click, two tabs or a retry would otherwise
 *  update the subscription twice — two items, two prorated charges. A claim
 *  row (membership_reminder_send, this codebase's "already did this" ledger,
 *  unique on member × kind × ref) is inserted BEFORE Stripe is called; the
 *  second request loses on the unique key and is told so. Released if the
 *  Stripe call fails, so a real retry works. */
async function claim(memberId: string, kind: string, ref: string): Promise<() => Promise<void>> {
  const { error } = await adminClient.from('membership_reminder_send').insert({ member_id: memberId, reminder_kind: kind, period_ref: ref });
  if (error?.code === '23505') throw Object.assign(new Error('This was already done — reload to see it.'), { status: 409 });
  if (error) throw new Error(`claim: ${error.message}`);
  return async () => {
    await adminClient.from('membership_reminder_send').delete().eq('member_id', memberId).eq('reminder_kind', kind).eq('period_ref', ref);
  };
}

/** Stripe's own idempotency, per call: the same request id replays the same
 *  answer instead of a second charge. */
const idem = (parts: string[]) => parts.join(':').slice(0, 255);

/** The tier's price for this member, by the join's rule. */
export async function tierPriceFor(ctx: Ctx, tierId: string): Promise<{ cents: number; name: string } | null> {
  const { data: tier } = await adminClient
    .from('membership_tier')
    .select('id, name, price_cents_year, price_cents_month, archived_at, workspace_id, price_includes_vat')
    .eq('id', tierId)
    .maybeSingle();
  if (!tier || tier.archived_at || tier.workspace_id !== ctx.member.workspace_id) return null;
  const base = ctx.interval === 'year' ? tier.price_cents_year : tier.price_cents_month;
  if (!base || base <= 0) return null;
  const logic = await priceLogicFor(ctx.member.workspace_id, tier.id as string);
  const { pct } = evaluatePriceLogic(logic, { country: ctx.member.country ?? null, interval: ctx.interval });
  // A price entered incl. VAT is changed at its NET, like at join.
  const cents = await chargeNet({ workspaceId: ctx.member.workspace_id, enteredCents: applyPct(base as number, pct), includesVat: tier.price_includes_vat as boolean, country: ctx.member.country ?? null });
  return { cents, name: tier.name as string };
}

/** How an add-on rides this membership: once (its own invoice), recurring
 *  (a line of the subscription — only when the interval matches, Stripe allows
 *  one interval per subscription, as at join), or not at all. */
export function addonFit(product: { price_interval: string | null }, interval: 'year' | 'month'): 'once' | 'recurring' | null {
  const iv = product.price_interval ?? 'once';
  if (iv === 'once') return 'once';
  return iv === interval ? 'recurring' : null;
}

/** The add-ons this member may add: optional products of their tier, not
 *  archived, not already held. */
export async function availableAddons(member: OwnedMember) {
  const { data: links } = await adminClient
    .from('membership_tier_product')
    .select('product:product_id (id, name, price_cents, price_interval, currency, archived_at, price_includes_vat)')
    .eq('tier_id', member.tier_id)
    .eq('optional', true);
  const { data: held } = await adminClient
    .from('membership_product_purchase')
    .select('product_id')
    .eq('person_id', member.person_id)
    .in('status', LIVE_PURCHASE_STATUSES);
  const owned = new Set((held ?? []).map((h) => h.product_id as string));
  const offered = (links ?? [])
    .map((l) => (Array.isArray(l.product) ? l.product[0] : l.product) as { id: string; name: string; price_cents: number | null; price_interval: string | null; currency: string | null; archived_at: string | null; price_includes_vat?: boolean } | null)
    .filter((p): p is NonNullable<typeof p> => !!p && !p.archived_at && !owned.has(p.id) && (p.price_cents ?? 0) > 0);
  // At their NET (a product entered incl. VAT), like at join.
  return Promise.all(offered.map(async (p) => ({ ...p, price_cents: await addonNet(member, p) })));
}

/** An add-on's charged price: its net when entered incl. VAT. */
export async function addonNet(member: OwnedMember, p: { price_cents: number | null; price_includes_vat?: boolean | null }): Promise<number> {
  return chargeNet({ workspaceId: member.workspace_id, enteredCents: p.price_cents ?? 0, includesVat: p.price_includes_vat, country: member.country ?? null });
}

/** The tiers this member may move to: same community, listed, not archived,
 *  priced for their interval, not the current one. Hidden tiers stay out
 *  (coordinator, 2026-10-15). */
export async function availableTiers(member: OwnedMember) {
  const { data } = await adminClient
    .from('membership_tier')
    .select('id, name, price_cents_year, price_cents_month, sort_order')
    .eq('workspace_id', member.workspace_id)
    .is('archived_at', null)
    .eq('hidden', false)
    .neq('id', member.tier_id)
    .order('sort_order');
  return data ?? [];
}

type Quote = { due_now_cents: number; tax_now_cents: number; then_cents: number; then_tax_cents: number; credit_cents: number; currency: string };

function quoteFrom(preview: Stripe.Invoice, thenPreview: Stripe.Invoice | null): Quote {
  const tax = (inv: Stripe.Invoice) => (inv.total_taxes ?? []).reduce((s, t) => s + (t.amount ?? 0), 0);
  const total = preview.total;
  return {
    due_now_cents: Math.max(0, total),
    tax_now_cents: total > 0 ? tax(preview) : 0,
    credit_cents: total < 0 ? -total : 0,
    then_cents: thenPreview ? thenPreview.total : 0,
    then_tax_cents: thenPreview ? tax(thenPreview) : 0,
    currency: preview.currency.toUpperCase(),
  };
}

/** The items as they would be after adding a recurring product. */
async function itemsWithAddon(ctx: Ctx, product: { id: string; name: string; price_cents: number }) {
  const prodId = await stripeProductFor(ctx, `product:${product.id}`, product.name);
  return [
    ...ctx.sub.items.data.map((it) => ({ id: it.id })),
    { price_data: { currency: ctx.currency, product: prodId, unit_amount: product.price_cents, recurring: { interval: ctx.interval } }, quantity: 1 },
  ];
}

async function itemsWithTier(ctx: Ctx, tierId: string, price: { cents: number; name: string }) {
  const prodId = await stripeProductFor(ctx, `tier:${tierId}`, `${ctx.workspaceName} membership — ${price.name}`);
  return ctx.sub.items.data.map((it) =>
    it.id === ctx.mainItem.id
      ? { id: it.id, price_data: { currency: ctx.currency, product: prodId, unit_amount: price.cents, recurring: { interval: ctx.interval } }, quantity: 1 }
      : { id: it.id },
  );
}

const previewFor = (ctx: Ctx, items: Stripe.InvoiceCreatePreviewParams.SubscriptionDetails.Item[], now: number) =>
  ctx.stripe.invoices.createPreview(
    {
      customer: ctx.member.stripe_customer_id,
      subscription: ctx.sub.id,
      subscription_details: { items, proration_behavior: 'always_invoice', proration_date: now },
    },
    { stripeAccount: ctx.account },
  );

/** What adding this add-on costs now and per period after. */
export async function previewAddon(ctx: Ctx, product: { id: string; name: string; price_cents: number; price_interval: string | null }): Promise<Quote> {
  const now = Math.floor(Date.now() / 1000);
  const fit = addonFit(product, ctx.interval);
  if (!fit) throw Object.assign(new Error(`This add-on is billed per ${product.price_interval} and cannot join a ${ctx.interval}ly membership.`), { status: 400 });
  if (fit === 'once') {
    // A one-off add-on: its price plus the subscription's VAT, once.
    const rate = ctx.sub.default_tax_rates?.[0] as Stripe.TaxRate | undefined;
    const tax = rate ? Math.round((product.price_cents * rate.percentage) / 100) : 0;
    return { due_now_cents: product.price_cents + tax, tax_now_cents: tax, credit_cents: 0, then_cents: 0, then_tax_cents: 0, currency: ctx.currency.toUpperCase() };
  }
  const items = await itemsWithAddon(ctx, product);
  const preview = await previewFor(ctx, items, now);
  const then = await ctx.stripe.invoices.createPreview(
    { customer: ctx.member.stripe_customer_id, subscription: ctx.sub.id, subscription_details: { items, proration_behavior: 'none' } },
    { stripeAccount: ctx.account },
  );
  return quoteFrom(preview, then);
}

export async function previewTierChange(ctx: Ctx, tierId: string): Promise<Quote | null> {
  const price = await tierPriceFor(ctx, tierId);
  if (!price) return null;
  const now = Math.floor(Date.now() / 1000);
  const items = await itemsWithTier(ctx, tierId, price);
  const preview = await previewFor(ctx, items, now);
  const then = await ctx.stripe.invoices.createPreview(
    { customer: ctx.member.stripe_customer_id, subscription: ctx.sub.id, subscription_details: { items, proration_behavior: 'none' } },
    { stripeAccount: ctx.account },
  );
  return quoteFrom(preview, then);
}

/** Add it: a recurring add-on joins the subscription (prorated now, then
 *  renewing with the membership); a one-off is invoiced once. The purchase is
 *  recorded and the member's access reconciled. */
export async function addAddon(
  ctx: Ctx,
  product: { id: string; name: string; price_cents: number; price_interval: string | null; currency: string | null },
  reconcile: (memberId: string) => Promise<void>,
  requestId: string = crypto.randomUUID(),
): Promise<{ invoice_id: string | null; amount_cents: number }> {
  // Held already (a paid purchase row, or — for a recurring one — a line of
  // the LIVE subscription for this product)? Refuse before claiming.
  const { count: held } = await adminClient
    .from('membership_product_purchase')
    .select('id', { count: 'exact', head: true })
    .eq('person_id', ctx.member.person_id)
    .eq('product_id', product.id)
    .in('status', LIVE_PURCHASE_STATUSES);
  const prodKey = `membership_stripe_product:${ctx.account}:product:${product.id}`;
  const mapped = (await adminClient.from('platform_setting').select('value').eq('key', prodKey).maybeSingle()).data?.value as string | undefined;
  const onSub = !!mapped && ctx.sub.items.data.some((it) => (typeof it.price.product === 'string' ? it.price.product : it.price.product.id) === mapped);
  if ((held ?? 0) > 0 || onSub) throw Object.assign(new Error(`${product.name} is already part of your membership.`), { status: 409 });
  const release = await claim(ctx.member.id, 'addon_claim', product.id);
  try {
    return await addAddonOnce(ctx, product, reconcile, requestId);
  } catch (e) {
    await release();
    throw e;
  }
}

async function addAddonOnce(
  ctx: Ctx,
  product: { id: string; name: string; price_cents: number; price_interval: string | null; currency: string | null },
  reconcile: (memberId: string) => Promise<void>,
  requestId: string,
): Promise<{ invoice_id: string | null; amount_cents: number }> {
  const key = (step: string) => idem(['addon', ctx.member.id, product.id, requestId, step]);
  let ref: string;
  let invoiceId: string | null = null;
  let amount = product.price_cents;
  const fit = addonFit(product, ctx.interval);
  if (!fit) throw Object.assign(new Error(`This add-on is billed per ${product.price_interval} and cannot join a ${ctx.interval}ly membership.`), { status: 400 });
  if (fit === 'recurring') {
    const updated = await ctx.stripe.subscriptions.update(
      ctx.sub.id,
      { items: await itemsWithAddon(ctx, product), proration_behavior: 'always_invoice' },
      { stripeAccount: ctx.account, idempotencyKey: key('update') },
    );
    const added = updated.items.data.find((it) => !ctx.sub.items.data.some((o) => o.id === it.id));
    ref = `addon-${added?.id ?? `${ctx.sub.id}-${product.id}`}`;
    invoiceId = typeof updated.latest_invoice === 'string' ? updated.latest_invoice : (updated.latest_invoice?.id ?? null);
    // The prorated invoice reaches the ledger through invoice.paid, like any
    // invoice of this subscription.
  } else {
    // One-off: an invoice of its own, the subscription's tax rate on it, the
    // platform fee on the net (as everywhere since 1.209.0).
    const rates = (ctx.sub.default_tax_rates ?? []).map((r) => (typeof r === 'string' ? r : r.id));
    const prodId = await stripeProductFor(ctx, `product:${product.id}`, product.name);
    const feePct = ctx.sub.application_fee_percent ?? 0;
    const ratePct = (ctx.sub.default_tax_rates?.[0] as Stripe.TaxRate | undefined)?.percentage ?? 0;
    const feeOnNet = Math.round((product.price_cents * ((feePct * (100 + ratePct)) / 100)) / 100);
    const inv = await ctx.stripe.invoices.create(
      {
        customer: ctx.member.stripe_customer_id,
        collection_method: 'charge_automatically',
        auto_advance: false,
        default_tax_rates: rates,
        ...(feeOnNet > 0 ? { application_fee_amount: feeOnNet } : {}),
        // item_label: the webhook's ledger write uses the same label as ours
        // below, so whichever lands second changes nothing.
        metadata: { workspace_id: ctx.member.workspace_id, person_id: ctx.member.person_id, membership_addon: product.id, item_label: `${ctx.workspaceName} — ${product.name}` },
      },
      { stripeAccount: ctx.account, idempotencyKey: key('invoice') },
    );
    await ctx.stripe.invoiceItems.create(
      { customer: ctx.member.stripe_customer_id, invoice: inv.id, pricing: { price_data: { currency: ctx.currency, product: prodId, unit_amount: product.price_cents } } as never, quantity: 1 },
      { stripeAccount: ctx.account, idempotencyKey: key('item') },
    ).catch(async () =>
      // Older shape of the same call.
      ctx.stripe.invoiceItems.create(
        { customer: ctx.member.stripe_customer_id, invoice: inv.id, price_data: { currency: ctx.currency, product: prodId, unit_amount: product.price_cents }, quantity: 1 } as never,
        { stripeAccount: ctx.account, idempotencyKey: key('item-legacy') },
      ),
    );
    const paid = await ctx.stripe.invoices.pay(inv.id!, {}, { stripeAccount: ctx.account, idempotencyKey: key('pay') });
    invoiceId = paid.id ?? null;
    amount = paid.amount_paid ?? amount;
    ref = `addon-${paid.id}`;
    const { data: person } = await adminClient.from('person').select('first_name, last_name, email').eq('id', ctx.member.person_id).maybeSingle();
    await recordPurchase({
      appSlug: 'membership',
      workspaceId: ctx.member.workspace_id,
      itemRef: paid.id!,
      personId: ctx.member.person_id,
      itemLabel: `${ctx.workspaceName} — ${product.name}`,
      payerName: [person?.first_name, person?.last_name].filter(Boolean).join(' '),
      payerEmail: (person?.email as string | null) ?? null,
      amountCents: amount,
      currency: (paid.currency ?? 'eur').toUpperCase(),
      method: 'stripe',
      status: 'paid',
      stripeInvoiceId: paid.id ?? null,
      stripeInvoiceUrl: paid.hosted_invoice_url ?? null,
      stripeAccountId: ctx.account,
      // The same breakdown the webhook writes for this invoice (an add-on is
      // priced excl. VAT, whatever rule the subscription started under).
      billing: { number: paid.number ?? null, pdf: paid.invoice_pdf ?? null, ...vatBreakdownFromInvoice(paid, { ...ctx.sub.metadata, vat_rule: 'excl' }) },
    });
  }
  const { error } = await adminClient.from('membership_product_purchase').insert({
    workspace_id: ctx.member.workspace_id,
    person_id: ctx.member.person_id,
    product_id: product.id,
    stripe_session_id: ref,
    amount_cents: amount,
    currency: (product.currency ?? ctx.currency).toUpperCase(),
    // A recurring add-on rides THIS subscription and ends with it.
    status: grantStatusFor(product.price_interval),
    ...(isRecurringInterval(product.price_interval) ? { stripe_subscription_id: ctx.sub.id } : {}),
  });
  if (error && error.code !== '23505') throw new Error(`add-on record: ${error.message}`);
  await reconcile(ctx.member.id);
  return { invoice_id: invoiceId, amount_cents: amount };
}

/** Move to another tier: the membership line's price swapped, prorated now
 *  (an upgrade is charged, a downgrade credited — or refunded, by the
 *  switch); the member's tier and access follow. */
export async function changeTier(
  ctx: Ctx,
  tierId: string,
  reconcile: (memberId: string) => Promise<void>,
  requestId: string = crypto.randomUUID(),
): Promise<{ credit_cents: number; refunded_cents: number }> {
  const price = await tierPriceFor(ctx, tierId);
  if (!price) throw Object.assign(new Error('That tier cannot be chosen.'), { status: 400 });
  // Already there — on the LIVE subscription (loadCtx reads it fresh)?
  const tierKey = `membership_stripe_product:${ctx.account}:tier:${tierId}`;
  const mapped = (await adminClient.from('platform_setting').select('value').eq('key', tierKey).maybeSingle()).data?.value as string | undefined;
  const mainProduct = typeof ctx.mainItem.price.product === 'string' ? ctx.mainItem.price.product : ctx.mainItem.price.product.id;
  if ((mapped && mainProduct === mapped && ctx.mainItem.price.unit_amount === price.cents) || ctx.member.tier_id === tierId) {
    throw Object.assign(new Error(`You are already a ${price.name} member.`), { status: 409 });
  }
  // One change per (target, the price the subscription is on NOW): a second
  // tab sees the same current price and loses on the claim; a later change
  // starts from a new price object and claims afresh.
  const release = await claim(ctx.member.id, 'tier_change_claim', `${tierId}:${ctx.mainItem.price.id}`);
  let updated: Stripe.Subscription;
  try {
    updated = await ctx.stripe.subscriptions.update(
      ctx.sub.id,
      { items: await itemsWithTier(ctx, tierId, price), proration_behavior: 'always_invoice', metadata: { ...ctx.sub.metadata, tier_id: tierId } },
      { stripeAccount: ctx.account, idempotencyKey: idem(['tier', ctx.member.id, tierId, requestId]) },
    );
  } catch (e) {
    await release();
    throw e;
  }
  let credit = 0;
  let refunded = 0;
  const latest = typeof updated.latest_invoice === 'string' ? updated.latest_invoice : updated.latest_invoice?.id;
  if (latest) {
    const inv = await ctx.stripe.invoices.retrieve(latest, {}, { stripeAccount: ctx.account });
    if (inv.total < 0) {
      credit = -inv.total;
      if (DOWNGRADE_REFUNDS) {
        // Refund the difference against the last paid charge, and take the
        // credit back off the balance so it is not given twice.
        const charges = await ctx.stripe.charges.list({ customer: ctx.member.stripe_customer_id, limit: 1 }, { stripeAccount: ctx.account });
        const charge = charges.data.find((ch) => ch.paid && !ch.refunded);
        if (charge) {
          const r = await ctx.stripe.refunds.create({ charge: charge.id, amount: Math.min(credit, charge.amount - charge.amount_refunded) }, { stripeAccount: ctx.account, idempotencyKey: idem(['tier-refund', ctx.member.id, tierId, requestId]) });
          refunded = r.amount;
          await ctx.stripe.customers.createBalanceTransaction(ctx.member.stripe_customer_id, { amount: refunded, currency: ctx.currency, description: 'Downgrade difference refunded' }, { stripeAccount: ctx.account, idempotencyKey: idem(['tier-balance', ctx.member.id, tierId, requestId]) });
        }
      }
    }
  }
  const { error } = await adminClient.from('membership_member').update({ tier_id: tierId, updated_at: new Date().toISOString() }).eq('id', ctx.member.id);
  if (error) throw new Error(`member tier: ${error.message}`);
  await reconcile(ctx.member.id);
  return { credit_cents: credit, refunded_cents: refunded };
}
