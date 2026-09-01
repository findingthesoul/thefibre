-- ============================================================================
-- Extra seats become billable — per-plan seat Prices on Stripe.
--
-- The subscription carries a second item: the plan's seat Price with
-- quantity = seats over the allowance. scripts/sync-stripe-plans.mjs creates
-- the Prices (monthly = extra_seat_cents_month; yearly = ×10, the same
-- two-months-free rule as the base price) and writes the ids here.
-- lib/seat-billing.ts keeps the quantity honest at invite, checkout and on
-- every subscription webhook.
-- ============================================================================

alter table public.billing_plan
  add column if not exists stripe_price_id_seat_month text,
  add column if not exists stripe_price_id_seat_year  text;

comment on column public.billing_plan.stripe_price_id_seat_month is
  'Per-extra-seat monthly Price on the platform Stripe account. Null until sync-stripe-plans.mjs runs (or the plan has no extra_seat_cents_month).';
