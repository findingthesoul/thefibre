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
const envPath = resolve(__dirname, '../.env');
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
    'id, name, price_cents_month, price_cents_year, stripe_product_id, stripe_price_id_month, stripe_price_id_year',
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

  const { error: uErr } = await db
    .from('billing_plan')
    .update({
      stripe_product_id: productId,
      stripe_price_id_month: monthId,
      stripe_price_id_year: yearId,
    })
    .eq('id', plan.id);
  if (uErr) {
    console.error(`${plan.id}: writing ids back failed:`, uErr.message);
    process.exit(1);
  }
}

console.log('\nDone. Checkout is live once STRIPE_BILLING_WEBHOOK_SECRET is also set —');
console.log('register https://thefibre-api.fly.dev/api/v1/billing/stripe-webhook for:');
console.log('  checkout.session.completed, customer.subscription.updated,');
console.log('  customer.subscription.deleted, invoice.paid, invoice.payment_failed');
