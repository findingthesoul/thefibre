-- What an Enterprise engagement costs BEFORE the subscription starts.
--
-- Sjoerd, 2026-09-27: *"for enterprise plan we should have a setup cost - and
-- training costs"*, and on the shape of training: a day rate AND a one-off.
--
-- Asked what these numbers should DO, he chose: shown, not charged. So this
-- is the plan's price list, the thing a quote is written from — not a Stripe
-- object and not something that appears on an invoice by itself. Charging
-- them is a later decision that will want an invoice line and a moment to
-- raise it; storing them is the part that has to exist first either way, and
-- the part that stops the numbers living in somebody's head.
--
-- All three are NULLABLE and all three are null on every existing plan.
-- A plan with no setup cost has no setup cost — it does not have a setup cost
-- of zero, which is a different sentence and would print "€0" on a page where
-- nothing should print at all. Every reader must treat null as "not offered".
--
-- Cents, like every other price in this table, so that nothing here is ever
-- the one column somebody has to remember is in euros.

alter table public.billing_plan
  add column if not exists setup_cents               integer,
  add column if not exists training_onboarding_cents integer,
  add column if not exists training_day_cents        integer;

comment on column public.billing_plan.setup_cents is
  'One-off cost of setting a workspace up, in cents. NULL = not offered on this plan, which is not the same as zero. Shown on the plan; not charged by the platform (2026-09-27).';
comment on column public.billing_plan.training_onboarding_cents is
  'One-off onboarding training package, in cents. NULL = not offered.';
comment on column public.billing_plan.training_day_cents is
  'Training day rate, in cents per day, for days beyond the onboarding package. NULL = not offered.';

-- Negative money is not a discount here, it is a mistake: these are list
-- prices read by a human writing a quote, and a minus sign would be read as
-- one at a glance and as the other by the page.
alter table public.billing_plan
  drop constraint if exists billing_plan_engagement_prices_non_negative;
alter table public.billing_plan
  add constraint billing_plan_engagement_prices_non_negative check (
    coalesce(setup_cents, 0) >= 0
    and coalesce(training_onboarding_cents, 0) >= 0
    and coalesce(training_day_cents, 0) >= 0
  );
