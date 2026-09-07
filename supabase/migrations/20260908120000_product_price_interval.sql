-- Product pricing intervals (Sjoerd 2026-09-08: "in pricing of a product
-- there should be a dropdown: per week, month, year, once-off").
--
-- 'once' = today's behaviour (a line on the first invoice). 'month'/'year'
-- ride the member's subscription as an extra recurring item — Stripe
-- forbids mixing intervals on one subscription, so a recurring product is
-- only offered when its interval matches the chosen tier interval. 'week'
-- is in the CHECK for the future but not offered by the UI yet (no weekly
-- tiers exist to carry it).

alter table public.membership_product
  add column price_interval text not null default 'once'
    check (price_interval in ('once', 'week', 'month', 'year'));
