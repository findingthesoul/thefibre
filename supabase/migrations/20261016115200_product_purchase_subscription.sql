-- A product grant that RENEWS knows its subscription (P4 remainder, slice 2).
--
-- membership_product_purchase was built for one-off purchases: a row with
-- status 'paid' is owned forever. A recurring product rides a subscription
-- (a membership's today; its own later), so its grant must be able to END —
-- when the subscription is cancelled or deleted, the add-on's grants,
-- member discount and directory category must go with it (found 2026-10-16:
-- they outlived a lapsed membership).
--
-- Additive only: new nullable columns, a wider status check, an index.
-- Existing rows keep status 'paid' and NULL subscription columns — a one-off
-- purchase is unchanged. No row is rewritten here.
--
--   status: paid | refunded           — a one-off (unchanged)
--           active | past_due | cancelled — a grant on a subscription
--
-- Columns are written by the webhook (lib/… in the next slice), never by a
-- client: the table's RLS is unchanged.

alter table public.membership_product_purchase
  add column stripe_subscription_id text,
  add column stripe_customer_id text,
  add column current_period_end timestamptz,
  add column cancel_at_period_end boolean not null default false,
  add column ends_at timestamptz;

alter table public.membership_product_purchase
  drop constraint if exists membership_product_purchase_status_check;
alter table public.membership_product_purchase
  add constraint membership_product_purchase_status_check
  check (status in ('paid', 'refunded', 'active', 'past_due', 'cancelled'));

-- The webhook finds every grant of one subscription by its id.
create index membership_product_purchase_subscription
  on public.membership_product_purchase (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column public.membership_product_purchase.stripe_subscription_id is
  'The Stripe subscription this grant rides (a membership''s, or the product''s own). NULL = a one-off purchase, owned while status is paid.';
comment on column public.membership_product_purchase.ends_at is
  'When a subscription grant stopped (status cancelled). NULL while live.';
