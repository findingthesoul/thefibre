-- ============================================================================
-- Stripe Billing ids on the plan catalogue.
--
-- The subscription itself (workspace → Solidarity Lab B.V.) runs on the
-- PLATFORM Stripe account — entirely separate from Connect, which carries
-- ticket money to organisers. One Product per plan, a monthly and a yearly
-- Price; apps/api/scripts/sync-stripe-plans.mjs creates them and writes the
-- ids here. Null = not yet synced (checkout 503s with a clear message).
-- ============================================================================

alter table public.billing_plan
  add column if not exists stripe_product_id     text,
  add column if not exists stripe_price_id_month text,
  add column if not exists stripe_price_id_year  text;

comment on column public.billing_plan.stripe_product_id is
  'Product on the PLATFORM Stripe account (Solidarity Lab), written by scripts/sync-stripe-plans.mjs. Null until synced.';
