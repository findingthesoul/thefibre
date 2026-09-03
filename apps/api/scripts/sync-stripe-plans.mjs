#!/usr/bin/env node
// Sync the plan catalogue to Stripe Billing — one Product per plan, a
// monthly and a yearly recurring Price, on the PLATFORM Stripe account
// (Solidarity Lab B.V., i.e. plain STRIPE_SECRET_KEY — never a connected
// account). Writes the ids back onto billing_plan; /api/v1/billing/checkout
// refuses politely until this has run.
//
// Idempotent: existing products are updated; a price whose amount matches is
// reused, a changed amount gets a NEW price (Stripe prices are immutable)
// and the old one is deactivated so the portal stops offering it.
//
// Usage:
//   node scripts/sync-stripe-plans.mjs
//
// Requires in apps/api/.env: NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY.

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', process.env.FIBRE_ENV_FILE ?? '.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=', 2))
    .filter((p) => p.length === 2),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_KEY = env.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/api/.env');
  process.exit(1);
}
if (!STRIPE_KEY) {
  console.error('Missing STRIPE_SECRET_KEY (apps/api/.env or environment)');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2026-04-22.dahlia' });

const { data: plans, error } = await db
  .from('billing_plan')
  .select(
    'id, name, price_cents_month, price_cents_year, extra_seat_cents_month, stripe_product_id, stripe_price_id_month, stripe_price_id_year, stripe_price_id_seat_month, stripe_price_id_seat_year',
  );
if (error) {
  console.error('billing_plan read failed:', error.message);
  process.exit(1);
}

async function ensurePrice(plan, productId, existingPriceId, cents, interval) {
  if (cents === null || cents === undefined || cents === 0) return null;
  if (existingPriceId) {
    const existing = await stripe.prices.retrieve(existingPriceId).catch(() => null);
    if (existing && existing.active && existing.unit_amount === cents) return existingPriceId;
    if (existing && existing.active) {
      await stripe.prices.update(existingPriceId, { active: false });
      console.log(`  deactivated stale ${interval} price ${existingPriceId}`);
    }
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: 'eur',
    unit_amount: cents,
    recurring: { interval },
    metadata: { plan_id: plan.id, fibre_interval: interval },
  });
  console.log(`  created ${interval} price ${price.id} (€${(cents / 100).toFixed(2)})`);
  return price.id;
}

for (const plan of plans ?? []) {
  // Free costs nothing and Enterprise is a conversation — neither needs a
  // price, but a Product for Enterprise does no harm and Free's is skipped.
  const sellable = (plan.price_cents_month ?? 0) > 0 || (plan.price_cents_year ?? 0) > 0;
  if (!sellable) {
    console.log(`${plan.id}: nothing to sell (€0) — skipped`);
    continue;
  }

  let productId = plan.stripe_product_id;
  if (productId) {
    const product = await stripe.products.retrieve(productId).catch(() => null);
    if (product) {
      if (product.name !== `The Fibre — ${plan.name}`) {
        await stripe.products.update(productId, { name: `The Fibre — ${plan.name}` });
      }
    } else {
      productId = null;
    }
  }
  if (!productId) {
    const product = await stripe.products.create({
      name: `The Fibre — ${plan.name}`,
      metadata: { plan_id: plan.id },
    });
    productId = product.id;
    console.log(`${plan.id}: created product ${productId}`);
  } else {
    console.log(`${plan.id}: product ${productId}`);
  }

  const monthId = await ensurePrice(
    plan,
    productId,
    plan.stripe_price_id_month,
    plan.price_cents_month,
    'month',
  );
  const yearId = await ensurePrice(
    plan,
    productId,
    plan.stripe_price_id_year,
    plan.price_cents_year,
    'year',
  );

  // Extra seats: their own Prices on the same Product, quantity-billed by
  // lib/seat-billing.ts. Yearly follows the same two-months-free rule as the
  // base (×10), so "yearly is two months free" is true of the whole invoice.
  const seatMonthId = await ensurePrice(
    plan,
    productId,
    plan.stripe_price_id_seat_month,
    plan.extra_seat_cents_month,
    'month',
  );
  const seatYearId = await ensurePrice(
    plan,
    productId,
    plan.stripe_price_id_seat_year,
    plan.extra_seat_cents_month ? plan.extra_seat_cents_month * 10 : null,
    'year',
  );

  const { error: uErr } = await db
    .from('billing_plan')
    .update({
      stripe_product_id: productId,
      stripe_price_id_month: monthId,
      stripe_price_id_year: yearId,
      stripe_price_id_seat_month: seatMonthId,
      stripe_price_id_seat_year: seatYearId,
    })
    .eq('id', plan.id);
  if (uErr) {
    console.error(`${plan.id}: writing ids back failed:`, uErr.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Billing-portal configuration — self-serve up/downgrade + cancellation
// (Signup v2). One configuration, tagged fibre=default, allowing switches
// between Starter and Pro (monthly + yearly) and cancel-at-period-end. Its id
// is written to platform_setting so routes/billing.ts passes it explicitly —
// per-database, so sandbox and live never share a configuration id.
// ---------------------------------------------------------------------------
const { data: portalRows } = await db
  .from('billing_plan')
  .select('id, stripe_product_id, stripe_price_id_month, stripe_price_id_year')
  .in('id', ['starter', 'pro']);
const portalProducts = (portalRows ?? [])
  .filter((r) => r.stripe_product_id && r.stripe_price_id_month)
  .map((r) => ({
    product: r.stripe_product_id,
    prices: [r.stripe_price_id_month, r.stripe_price_id_year].filter(Boolean),
  }));

if (portalProducts.length) {
  const returnUrl = `${env.NEXT_PUBLIC_FIBRE_URL ?? 'https://thefibre.app'}/settings/plan`;
  const params = {
    business_profile: { headline: 'The Fibre — your plan' },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ['email', 'address', 'tax_id'] },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        products: portalProducts,
        proration_behavior: 'create_prorations',
      },
    },
    default_return_url: returnUrl,
    metadata: { fibre: 'default' },
  };
  const existingCfgs = await stripe.billingPortal.configurations.list({ limit: 20 });
  const mine = existingCfgs.data.find((c) => c.metadata?.fibre === 'default');
  const cfg = mine
    ? await stripe.billingPortal.configurations.update(mine.id, params)
    : await stripe.billingPortal.configurations.create(params);
  const { error: psErr } = await db
    .from('platform_setting')
    .upsert(
      { key: 'stripe_portal_configuration', value: cfg.id, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );
  if (psErr) console.error('portal config id write failed:', psErr.message);
  console.log(`portal configuration: ${cfg.id} (switch Starter↔Pro, cancel at period end)`);
}

console.log('\nDone. Checkout is live once STRIPE_BILLING_WEBHOOK_SECRET is also set —');
console.log('register https://thefibre-api.fly.dev/api/v1/billing/stripe-webhook for:');
console.log('  checkout.session.completed, customer.subscription.updated,');
console.log('  customer.subscription.deleted, invoice.paid, invoice.payment_failed');
