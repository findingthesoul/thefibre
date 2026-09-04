-- Access grants attach to PRODUCTS (Sjoerd, 2026-09-05: "why is this not
-- under products" — the product is the promise, so the product carries the
-- access that fulfills it). Tier → products → grants; a member's
-- entitlement is every grant carried by their tier's products, plus any
-- legacy tier-level grant (kept valid, no longer created).
alter table public.membership_access_grant
  add column if not exists product_id uuid references public.membership_product(id) on delete cascade,
  alter column tier_id drop not null;

alter table public.membership_access_grant
  drop constraint if exists membership_access_grant_target;
alter table public.membership_access_grant
  add constraint membership_access_grant_target
  check (product_id is not null or tier_id is not null);

create index if not exists membership_access_grant_product
  on public.membership_access_grant (product_id);
