-- A tier whose FIRST period ends on a fixed date (2026-10-13).
--
-- Sjoerd, on the soul.com launch cohort: "For the people I invite now... they
-- have to pay for the past year (2026) and runs up 31/12/2026." Ordinary joins
-- keep anniversary billing — somebody joining on 30 December renews on 30
-- December — so this is NOT a recurring yearly anchor. It is one date, for one
-- cohort, and it expires by itself: once the date has passed the column is
-- inert and joins fall back to anniversary billing with nothing to clean up.
--
-- How a join reads it (routes/membership.ts): while the date is in the future,
-- the tier's full period price is charged NOW as a one-off line, and the
-- recurring line's billing_cycle_anchor is set to the day after this date with
-- proration_behavior 'none' — so exactly one charge now and the next on the
-- first of January, never a proration. (trial_end cannot be used here: Stripe
-- requires it to be at least 48 hours ahead, which a 30 December join fails.)
alter table public.membership_tier
  add column if not exists first_period_ends_on date;

comment on column public.membership_tier.first_period_ends_on is
  'One-time launch-cohort billing: while this date is in the future, a join pays the full period price now and the subscription''s first renewal is the day after this date. Null (the default) means ordinary anniversary billing. Self-expiring — a past date behaves as null.';
