-- ===========================================================================
-- À-la-carte product buying (build-plan: "à-la-carte product buying").
--
-- membership_product rows have always carried a price; until now the only
-- path to a product was inside a tier bundle. This adds:
--
--   1. membership_product.purchasable — the product's own setting for "can
--      be bought standalone". Price alone is not the signal: a priced
--      product may still be tier-only (the price then documents value /
--      feeds future proration), so standalone selling is an explicit flag.
--
--   2. membership_product_purchase — the standalone-purchase record, keyed
--      by PERSON, not member. Deliberate (task rule: never fabricate a fake
--      member row): a buyer need not hold a membership. The money itself
--      lands in the platform purchase ledger via recordPurchase (Stripe is
--      rails, the ledger is the record); this table is the app-side fact
--      "this person owns this product", which:
--        - reconcileMemberAccess folds into a member's entitlement (bought
--          products' grants are granted alongside tier grants, survive tier
--          changes AND lapse — bought outright, not part of the
--          subscription), and
--        - the /my portal lists (products + their links).
--      For a buyer with no member row the external-access journal has
--      nowhere to hang (membership_member_access is member-keyed and the
--      sync workers join through member) — their grants materialise the
--      moment a member row appears for the same person, via the same
--      reconcile. Links are delivered immediately either way (receipt email
--      + /my).
--
-- stripe_session_id is the idempotency anchor: one row per Checkout
-- session, insert-first, 23505 = webhook retry, no-op.
-- ===========================================================================

alter table public.membership_product
  add column if not exists purchasable boolean not null default false;

create table public.membership_product_purchase (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  person_id uuid not null references public.person(id),
  product_id uuid not null references public.membership_product(id),
  stripe_session_id text not null unique,
  amount_cents integer not null,
  currency text not null default 'EUR',
  status text not null default 'paid'
    check (status in ('paid', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index membership_product_purchase_ws on public.membership_product_purchase (workspace_id);
create index membership_product_purchase_person on public.membership_product_purchase (person_id);
create index membership_product_purchase_product on public.membership_product_purchase (product_id);

-- RLS: workspace users with the app see purchases (feeds admin surfaces
-- and the emergent profile tab); ALL writes are webhook/service-role — no
-- authenticated write policy on purpose.
alter table public.membership_product_purchase enable row level security;

create policy membership_product_purchase_read on public.membership_product_purchase
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
  );
