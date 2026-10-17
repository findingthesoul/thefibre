// Move ONE member's one-off add-on purchase onto her membership subscription,
// from her next renewal on: nothing charged now, no proration, no double
// charge, no gap in ownership.
//
// Sjoerd, 2026-10-17: "ok to move." A soul.com member bought the email add-on
// as a one-off on 2026-10-15, a workaround from before add-ons could ride a
// membership. From her renewal it should renew with the membership like any
// other member's add-on: one invoice, the subscription's VAT, and it stops
// when the membership's renewal is stopped in my.thread → Purchases.
//
//   cd apps/api
//   npx tsx --env-file=.env scripts/move-addon-to-membership.ts prod --workspace soul --email <addr> --product <id|name>          # dry run
//   npx tsx --env-file=.env scripts/move-addon-to-membership.ts prod --workspace soul --email <addr> --product <id|name> --apply  # writes
//
// What --apply does, in this order (a re-run repeats only what is missing):
//   1. STRIPE. The product joins the membership subscription as an item,
//      `proration_behavior: 'none'`. With 'none', Stripe creates no invoice
//      and no proration line now; the item is first billed, for a full
//      period, on the renewal invoice, together with the membership and
//      under the subscription's default tax rate. A subscription schedule
//      phase at the period end would bill the same and nothing earlier, but
//      nothing else in this codebase uses schedules. A schedule also takes
//      over the subscription's future changes (a tier change or a VAT
//      correction would have to edit the phase), so the plain item is the
//      smaller change. The item uses the same Stripe product mapping as
//      addAddon, so "already part of your membership" recognises it.
//      After the call the script checks that the subscription's latest
//      invoice is unchanged, i.e. that nothing was invoiced now.
//   2. OWNERSHIP. The one-off purchase row is CONVERTED in place: it gets the
//      subscription id, status 'active' and the period end, exactly the
//      shape addAddon writes for a recurring add-on. One row throughout: no
//      gap (it is owned before, during and after), no double grant (a
//      second row beside a 'paid' one would be owned forever, because a
//      'paid' row never ends; product-ownership.ts). From here the webhooks
//      treat it like any add-on riding a membership: renewed by invoice.paid,
//      past_due with the membership, ended by endSubscriptionGrants when it
//      lapses. Its first payment stays in the purchase ledger as it was.
// Idempotent: a subscription that already carries the item skips step 1;
// a row already on the subscription skips step 2. A second run reports
// "nothing to do" and writes nothing.

import type Stripe from 'stripe';
import { adminClient } from '../src/db.js';
import { addonFit, addonNet, loadCtx, stripeProductFor, type Ctx } from '../src/lib/membership-change.js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';
const args = process.argv.slice(2);
const target = args[0];
const opt = (name: string) => {
  const i = args.indexOf(name);
  const v = i >= 0 ? args[i + 1] : undefined;
  return v && !v.startsWith('--') ? v : undefined;
};
const wsSlug = opt('--workspace');
const email = opt('--email')?.toLowerCase();
const productArg = opt('--product');
const oneOffArg = opt('--one-off');
const apply = args.includes('--apply');
if ((target !== 'prod' && target !== 'staging') || !wsSlug || !email || !productArg) {
  console.error('usage: npx tsx --env-file=<env> scripts/move-addon-to-membership.ts prod|staging --workspace <slug> --email <addr> --product <id|name> [--one-off <purchase id>] [--apply]');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(target === 'prod' ? PRODUCTION_REF : STAGING_REF)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}
function refuse(why: string): never {
  console.error(`REFUSED: ${why}`);
  process.exit(2);
}
const money = (cents: number, cur: string) => `${(cents / 100).toFixed(2)} ${cur.toUpperCase()}`;
const day = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString().slice(0, 10) : '?');

// ── Who, and what ─────────────────────────────────────────────────────────
const { data: ws } = await adminClient.from('workspace').select('id, name').eq('slug', wsSlug).maybeSingle();
if (!ws) refuse(`no workspace "${wsSlug}"`);
const wsId = ws!.id as string;

const { data: persons } = await adminClient.from('person').select('id, first_name, last_name, email').eq('workspace_id', wsId).ilike('email', email!).is('deleted_at', null);
const personIds = (persons ?? []).map((p) => p.id as string);
if (!personIds.length) refuse(`no person with ${email} in ${wsSlug}`);

const { data: members } = await adminClient
  .from('membership_member')
  .select('id, workspace_id, person_id, tier_id, country, status, stripe_subscription_id, stripe_customer_id')
  .eq('workspace_id', wsId)
  .in('person_id', personIds)
  .in('status', ['active', 'grace']);
if ((members ?? []).length !== 1) refuse(`expected exactly one live membership for ${email}, found ${(members ?? []).length}`);
const m = members![0]!;
if (!m.stripe_subscription_id || !m.stripe_customer_id) refuse('this membership has no Stripe subscription (managed directly by the community)');
const person = (persons ?? []).find((p) => p.id === m.person_id)!;

const isUuid = /^[0-9a-f-]{36}$/i.test(productArg!);
const { data: products } = await adminClient
  .from('membership_product')
  .select('id, name, price_cents, price_interval, currency, archived_at, price_includes_vat')
  .eq('workspace_id', wsId)
  .eq(isUuid ? 'id' : 'name', productArg!);
if ((products ?? []).length !== 1) refuse(`expected one product "${productArg}" in ${wsSlug}, found ${(products ?? []).length}`);
const product = products![0]!;

const ctxOrErr = await loadCtx({
  id: m.id as string,
  workspace_id: wsId,
  person_id: m.person_id as string,
  tier_id: m.tier_id as string,
  country: (m.country as string | null) ?? null,
  stripe_subscription_id: m.stripe_subscription_id as string,
  stripe_customer_id: m.stripe_customer_id as string,
});
if ('error' in ctxOrErr) refuse(`subscription: ${ctxOrErr.error}`);
const ctx = ctxOrErr as Ctx;
const sub = ctx.sub;
if (sub.schedule) refuse(`subscription ${sub.id} is driven by a subscription schedule; an item change would be overwritten by its next phase`);
if (addonFit(product, ctx.interval) !== 'recurring') {
  refuse(`${product.name} is priced per ${product.price_interval ?? 'once'}, so it cannot renew with a ${ctx.interval}ly membership`);
}
const net = await addonNet(ctx.member, product);
if (net <= 0) refuse(`${product.name} has no price`);
const periodEnd = ctx.mainItem.current_period_end;
const rate = sub.default_tax_rates?.[0] as Stripe.TaxRate | undefined;

// ── Current state ─────────────────────────────────────────────────────────
const prodKey = `membership_stripe_product:${ctx.account}:product:${product.id}`;
const mapped = (await adminClient.from('platform_setting').select('value').eq('key', prodKey).maybeSingle()).data?.value as string | undefined;
const productOf = (it: Stripe.SubscriptionItem) => (typeof it.price.product === 'string' ? it.price.product : it.price.product.id);
const existingItem = mapped ? sub.items.data.find((it) => productOf(it) === mapped) : undefined;

const { data: rows } = await adminClient
  .from('membership_product_purchase')
  .select('id, product_id, status, stripe_session_id, stripe_subscription_id, amount_cents, currency, created_at')
  .eq('person_id', m.person_id)
  .in('status', ['paid', 'active', 'past_due']);
const onSub = (rows ?? []).filter((r) => r.product_id === product.id && r.stripe_subscription_id === sub.id);
const oneOffs = (rows ?? []).filter((r) => !r.stripe_subscription_id && r.status === 'paid' && (oneOffArg ? r.id === oneOffArg : r.product_id === product.id));

console.log(`${target} · ${ws!.name} (${wsSlug}) · ${apply ? 'APPLYING' : 'dry run'}\n`);
console.log(`member        ${[person.first_name, person.last_name].filter(Boolean).join(' ')} <${person.email}> · membership ${m.id} (${m.status})`);
console.log(`subscription  ${sub.id} · ${sub.status} · ${ctx.interval}ly · renews ${day(periodEnd)} · latest invoice ${typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice?.id ?? 'none'}`);
console.log(`              tax rate ${rate ? `${rate.percentage}% (${rate.id})` : 'none'} · items: ${sub.items.data.map((it) => `${(it.price.product as Stripe.Product).name ?? productOf(it)} ${money(it.price.unit_amount ?? 0, it.price.currency)}`).join(', ')}`);
console.log(`product       ${product.name} (${product.id}) · ${money(net, ctx.currency)} net per ${ctx.interval}${product.price_includes_vat ? ' (entered incl. VAT)' : ''}`);
console.log(`stripe item   ${existingItem ? `ALREADY on the subscription (${existingItem.id})` : 'not on the subscription'}`);
for (const r of oneOffs) console.log(`one-off row   ${r.id} · ${r.stripe_session_id} · ${money(r.amount_cents as number, r.currency as string)} · bought ${String(r.created_at).slice(0, 10)}`);
for (const r of onSub) console.log(`on-sub row    ${r.id} · status ${r.status} · ALREADY rides the subscription`);

if (onSub.length && oneOffs.length) refuse('the product is already granted on the subscription AND by a one-off row; resolve by hand, nothing written');
if (!onSub.length && oneOffs.length !== 1) {
  const all = (rows ?? []).filter((r) => !r.stripe_subscription_id && r.status === 'paid');
  refuse(`expected one live one-off purchase of ${product.name}, found ${oneOffs.length}. One-off rows for this person: ${all.map((r) => `${r.id} (product ${r.product_id})`).join(', ') || 'none'}. Name one with --one-off <id>.`);
}
const row = oneOffs[0];

// What the renewal invoice will be, as Stripe computes it (the same call
// the my.thread preview uses).
const items = existingItem
  ? sub.items.data.map((it) => ({ id: it.id }))
  : [...sub.items.data.map((it) => ({ id: it.id })), { price_data: { currency: ctx.currency, product: mapped ?? 'pending', unit_amount: net, recurring: { interval: ctx.interval } }, quantity: 1 }];
if (mapped || existingItem) {
  const then = await ctx.stripe.invoices.createPreview(
    { customer: ctx.member.stripe_customer_id, subscription: sub.id, subscription_details: { items, proration_behavior: 'none' } },
    { stripeAccount: ctx.account },
  );
  console.log(`renewal       Stripe's preview of the ${day(periodEnd)} invoice: ${money(then.total, then.currency)} (${then.lines.data.map((l) => `${l.description} ${money(l.amount, then.currency)}`).join(' · ')})`);
} else {
  console.log(`renewal       (no Stripe product for ${product.name} on this account yet; created by --apply, then the renewal preview is printed)`);
}

console.log('\nplan');
console.log(existingItem ? '  1. stripe: nothing (the item is already there)' : `  1. stripe: add ${product.name} at ${money(net, ctx.currency)}/${ctx.interval} to ${sub.id}, proration_behavior none: invoiced first on ${day(periodEnd)}, nothing now`);
console.log(row ? `  2. ownership: convert ${row.id} to ride ${sub.id} (status active, period end ${day(periodEnd)}), so one row is owned throughout` : '  2. ownership: nothing (the grant already rides the subscription)');
if (existingItem && !row) {
  console.log('\nnothing to do.');
  process.exit(0);
}
if (!apply) {
  console.log('\ndry run: nothing written. Add --apply to do the above.');
  process.exit(0);
}

// ── Apply ─────────────────────────────────────────────────────────────────
if (!existingItem) {
  const prodId = await stripeProductFor(ctx, `product:${product.id}`, product.name);
  const before = typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice?.id ?? null;
  const updated = await ctx.stripe.subscriptions.update(
    sub.id,
    {
      items: [...sub.items.data.map((it) => ({ id: it.id })), { price_data: { currency: ctx.currency, product: prodId, unit_amount: net, recurring: { interval: ctx.interval } }, quantity: 1 }],
      proration_behavior: 'none',
    },
    { stripeAccount: ctx.account, idempotencyKey: `move-addon:${m.id}:${product.id}:${sub.id}` },
  );
  const after = typeof updated.latest_invoice === 'string' ? updated.latest_invoice : updated.latest_invoice?.id ?? null;
  const added = updated.items.data.find((it) => productOf(it) === prodId);
  console.log(`stripe        added item ${added?.id ?? '?'} · latest invoice ${before ?? 'none'} → ${after ?? 'none'}${before === after ? ' (unchanged: nothing invoiced now)' : '  ⚠️ CHANGED: check this invoice in Stripe'}`);
  const then = await ctx.stripe.invoices.createPreview({ customer: ctx.member.stripe_customer_id, subscription: sub.id }, { stripeAccount: ctx.account });
  console.log(`renewal       Stripe's preview of the next invoice: ${money(then.total, then.currency)} on ${day(then.period_end ?? null)} (${then.lines.data.map((l) => `${l.description} ${money(l.amount, then.currency)}`).join(' · ')})`);
}
if (row) {
  const { data: done, error } = await adminClient
    .from('membership_product_purchase')
    .update({
      stripe_subscription_id: sub.id,
      stripe_customer_id: ctx.member.stripe_customer_id,
      status: 'active',
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .is('stripe_subscription_id', null)
    .eq('status', 'paid')
    .select('id, status, stripe_subscription_id');
  if (error) refuse(`converting ${row.id}: ${error.message} (the Stripe item is in place; re-run to finish)`);
  console.log(`ownership     ${done?.length ? `${row.id} now rides ${sub.id} (active)` : `${row.id} changed under us; re-run to see its state`}`);
}
console.log('\ndone. Re-run the same command: it should say "nothing to do."');
