-- ============================================================================
-- Productisation surfaces — yearly prices + tailored per-workspace pricing.
--
-- docs/productisation-proposal.md (2026-09-01). Two additive changes:
--
-- 1. billing_plan.price_cents_year — the annual price is DECIDED ("two months
--    free": €190 / €490, docs/pricing-proposal.md) but was never stored. It is
--    a column rather than price_cents_month * 10 computed in code, because the
--    day a promo breaks the ×10 rule the stored number survives and the
--    formula lies. Null = not sold yearly (Enterprise is a conversation).
--
-- 2. workspace_subscription.custom_price_cents_{month,year} — tailored
--    pricing for a single workspace (a social enterprise on Pro at €25, say)
--    WITHOUT inventing a plan for them. Null = list price. The comp mechanism
--    (status='comped' + reason) stays the lever for "free, and say why";
--    custom price is the lever for "the same package, at their price".
--    Nothing but display and (later) Stripe subscription creation reads it —
--    feature gates always come from the plan, never from the price.
-- ============================================================================

alter table public.billing_plan
  add column if not exists price_cents_year integer;

comment on column public.billing_plan.price_cents_year is
  'Per workspace per year, ex-VAT. Null = not offered yearly. Stored, not computed: a promo that breaks the two-months-free rule must not silently change the price.';

update public.billing_plan set price_cents_year = 0     where id = 'free';
update public.billing_plan set price_cents_year = 19000 where id = 'starter';
update public.billing_plan set price_cents_year = 49000 where id = 'pro';
-- 'org' (Enterprise) stays null — a conversation, not a price list.

alter table public.workspace_subscription
  add column if not exists custom_price_cents_month integer,
  add column if not exists custom_price_cents_year  integer;

comment on column public.workspace_subscription.custom_price_cents_month is
  'Tailored monthly price for THIS workspace, ex-VAT. Null = the plan''s list price. Set by a super admin (/admin/workspaces). Prices, never features: gates always read the plan.';
comment on column public.workspace_subscription.custom_price_cents_year is
  'Tailored yearly price for this workspace. Null = the plan''s list price.';
