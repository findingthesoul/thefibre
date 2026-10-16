-- ONE GRANT PER PRODUCT PER SUBSCRIPTION — a database guarantee (2026-10-16).
--
-- A product subscription's grants are written by whichever Stripe event lands
-- first: checkout.session.completed or invoice.paid (Stripe does not order
-- them, and a subscription made through the API sends no session event). Both
-- handlers write the same grant; when Stripe delivers both at the same moment
-- the two requests run in parallel, and a check-then-insert in code would
-- write it twice. This index makes the second insert a 23505, which the
-- handler reads as "already there".
--
-- LIVE GRANTS ONLY. A grant that ended stays as its record (status
-- 'cancelled' — a status change, never a delete), so a member who removes an
-- add-on and later adds it again has a cancelled row AND a new active row on
-- the same (membership subscription, product). The index must allow that,
-- so it covers only the live statuses — which are exactly
-- LIVE_PURCHASE_STATUSES in apps/api/src/lib/product-ownership.ts
-- ('paid', 'active', 'past_due'). A partial index cannot import that
-- constant: change BOTH together. 'paid' is in on purpose — a product
-- subscription's one-off line carries the subscription id with status
-- 'paid', and it is never cancelled (endSubscriptionGrants stops only
-- active/past_due), so it can never block a re-add.
--
-- One-off purchases with no subscription are keyed by their session as
-- before. Checked on staging before creating it: 0 duplicate
-- (stripe_subscription_id, product_id) pairs among the rows that have one.
create unique index if not exists membership_product_purchase_one_per_subscription
  on public.membership_product_purchase (stripe_subscription_id, product_id)
  where stripe_subscription_id is not null
    and status in ('paid', 'active', 'past_due');
