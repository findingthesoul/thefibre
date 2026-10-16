-- A RECURRING product whose first period ends on a fixed date (Sjoerd,
-- 2026-10-16: "For products also First period ends on (optional)").
--
-- The same setting tiers have had since 20261013111228, read the same way
-- (fixedFirstPeriod, @thefibre/shared/fixed-renewal): while the date is in
-- the future, the first period runs until it and renewals follow from the day
-- after. Self-expiring — a past date behaves as null. Null is the default:
-- ordinary anniversary billing.
--
-- It applies when someone subscribes to the product ON ITS OWN. As an add-on
-- to a membership, the product rides the membership's subscription and renews
-- on the membership's date — that path does not read this column.
--
-- Additive: one nullable column, nothing existing changes.
alter table public.membership_product
  add column if not exists first_period_ends_on date;

comment on column public.membership_product.first_period_ends_on is
  'For a recurring product subscribed to on its own: while this date is in the future, the first period runs until it and the first renewal is the day after. Null = anniversary billing. Self-expiring. Ignored for an add-on riding a membership (it renews with the membership).';
