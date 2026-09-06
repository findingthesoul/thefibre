-- Optional add-on products at join time (Sjoerd, 2026-09-06: "maybe the
-- member can also choose a product that is offered as an option... which
-- may increase the price or is included if 0").
--
-- A tier↔product link is now either INCLUDED (optional=false — the default,
-- today's behavior: grants flow to every member) or OPTIONAL (optional=true
-- — offered as a tick-box on the join page; a priced option raises the
-- first invoice, a €0 option is simply included if chosen). Chosen options
-- are recorded as membership_product_purchase rows, so their grants ride
-- the existing bought-product journal path — including the survive-lapse
-- exception (an add-on was paid for outright).
alter table public.membership_tier_product
  add column if not exists optional boolean not null default false;

-- membership_product_purchase's idempotency anchor was one-row-per-session
-- (à-la-carte: one product per checkout). A join with N ticked options is
-- ONE session with N purchase rows — the anchor widens to (session,
-- product); the à-la-carte webhook's 23505-means-done contract holds.
alter table public.membership_product_purchase
  drop constraint if exists membership_product_purchase_stripe_session_id_key;
alter table public.membership_product_purchase
  add constraint membership_product_purchase_session_product_key
    unique (stripe_session_id, product_id);
