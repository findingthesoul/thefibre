-- ===========================================================================
-- Fibre Membership — schema + app registration (Membership 0.1.0)
--
-- docs/membership-proposal.md is the spec (D1–D6 all accepted 2026-09-04).
-- A workspace sells tiered recurring memberships to its community: tiers,
-- a product catalogue, member lifecycle (active → grace → lapsed →
-- rejoined), access grants synced to external tools (Circle.so first).
--
-- In-family rule: person / organisation / workspace are used natively;
-- everything below is Membership-owned content (membership_ prefix, public
-- schema — the Flow/Pulse pattern). Money lands in the platform purchase
-- ledger via recordPurchase; this schema stores no ledger of its own.
--
-- App registration uses the open catalogue (v0.14.0): a plain insert, no
-- slug allow-list — that constraint is gone and stays gone.
-- ===========================================================================

-- 1 · App catalogue row -----------------------------------------------------

-- released_at stays NULL until the frontend ships — that's the catalogue's
-- own "built but not live" latch: /admin/apps shows it, activation is
-- refused. The release migration flips it.
insert into public.app (slug, name, base_url, status, kind, released_at, description)
values (
  'membership',
  'Membership',
  'https://membership.thefibre.app',
  'approved',
  'first_party',
  null,
  'Tiered community memberships: recurring subscriptions, a product catalogue, and access to member spaces.'
)
on conflict (slug) do nothing;

-- 2 · Tables ----------------------------------------------------------------

-- What a workspace sells. Prices are yearly-first (the soul.com case);
-- monthly is optional. Stripe price ids live per tier because each
-- workspace's tiers become Prices on ITS connected account, not ours.
create table public.membership_tier (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  name text not null,
  description text,
  characteristics jsonb not null default '[]'::jsonb,
  price_cents_year integer,
  price_cents_month integer,
  currency text not null default 'EUR',
  stripe_price_id_year text,
  stripe_price_id_month text,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index membership_tier_ws on public.membership_tier (workspace_id);

-- The catalogue: things a membership gives access to (or that are sold
-- alongside). links = [{kind: 'thread'|'meet'|'circle_space'|'url', ref}].
create table public.membership_product (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  name text not null,
  description text,
  characteristics jsonb not null default '[]'::jsonb,
  price_cents integer,              -- null = included-in-tier only
  currency text not null default 'EUR',
  links jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index membership_product_ws on public.membership_product (workspace_id);

create table public.membership_tier_product (
  id uuid primary key default gen_random_uuid(),
  tier_id uuid not null references public.membership_tier(id) on delete cascade,
  product_id uuid not null references public.membership_product(id) on delete cascade,
  unique (tier_id, product_id)
);

-- The member record — system of record for the lifecycle (proposal §3.8:
-- Stripe webhooks write status directly; Flow reacts, never decides).
-- organisation_id + seat_allowance are the org-membership prep (§3.5):
-- NULL in v1, and no logic may assume person_id semantics beyond "the
-- individual this membership wraps".
create table public.membership_member (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  person_id uuid not null references public.person(id),
  organisation_id uuid references public.organisation(id),
  seat_allowance integer,
  tier_id uuid not null references public.membership_tier(id),
  status text not null default 'active'
    check (status in ('active', 'grace', 'lapsed', 'cancelled')),
  started_at timestamptz not null default now(),
  renews_at timestamptz,
  lapsed_at timestamptz,
  stripe_subscription_id text,
  stripe_customer_id text,
  notes text,
  deleted_at timestamptz,           -- soft delete only (hard rule 4)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One membership per person per workspace; rejoin reuses the row so the
  -- history (started_at, activity trail) survives the lapse.
  unique (workspace_id, person_id)
);
create index membership_member_ws on public.membership_member (workspace_id);
create index membership_member_person on public.membership_member (person_id);
-- The renewal scheduler scans by status + renews_at.
create index membership_member_renews on public.membership_member (status, renews_at);
create index membership_member_sub on public.membership_member (stripe_subscription_id);

-- What a tier unlocks in the outside world. kind is validated in the API
-- (zod), not a CHECK — adding a kind is a deploy, like app-key scopes.
-- config holds non-secret targeting only (e.g. {space_id}); credentials
-- for the external tool live in membership_settings (service-role only).
create table public.membership_access_grant (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  tier_id uuid not null references public.membership_tier(id) on delete cascade,
  kind text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index membership_access_grant_ws on public.membership_access_grant (workspace_id);

-- The sync journal: one row per (member × grant), idempotent workers move
-- status and stamp synced_at / last_error. Re-runnable by design.
create table public.membership_member_access (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.membership_member(id) on delete cascade,
  access_grant_id uuid not null references public.membership_access_grant(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'granted', 'revoke_pending', 'revoked', 'error')),
  external_ref text,
  last_error text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, access_grant_id)
);

-- Workspace-level settings INCLUDING external-tool credentials (the Circle
-- API token). Credential rule (Connections SPoT precedent): service-role
-- only — RLS enabled, NO authenticated policy, all access through the API
-- with an explicit workspace filter.
create table public.membership_settings (
  workspace_id uuid primary key references public.workspace(id) on delete cascade,
  circle_api_token text,
  circle_community_url text,
  join_page jsonb not null default '{}'::jsonb,   -- public page copy/config
  updated_at timestamptz not null default now()
);

-- Renewal-reminder dedup, the thread_message_send pattern: insert-first,
-- 23505 = already sent. period_ref pins the reminder to one renewal cycle
-- (e.g. the renews_at date it warned about) so next year's reminder for
-- the same member still goes out.
create table public.membership_reminder_send (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.membership_member(id) on delete cascade,
  reminder_kind text not null,      -- 'renewal_upcoming' | 'payment_failed' | …
  period_ref text not null,
  email text,
  sent_at timestamptz not null default now(),
  unique (member_id, reminder_kind, period_ref)
);

-- 3 · RLS -------------------------------------------------------------------

alter table public.membership_tier enable row level security;
alter table public.membership_product enable row level security;
alter table public.membership_tier_product enable row level security;
alter table public.membership_member enable row level security;
alter table public.membership_access_grant enable row level security;
alter table public.membership_member_access enable row level security;
alter table public.membership_settings enable row level security;
alter table public.membership_reminder_send enable row level security;

-- Tiers + products: member-visible reference data (Shape C — split
-- read/write). Anyone in the workspace with the app sees the catalogue;
-- only admins shape it.
create policy membership_tier_read on public.membership_tier
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
  );
create policy membership_tier_insert on public.membership_tier
  for insert to authenticated
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and public.is_workspace_admin()
  );
create policy membership_tier_update on public.membership_tier
  for update to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and public.is_workspace_admin()
  );

create policy membership_product_read on public.membership_product
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
  );
create policy membership_product_insert on public.membership_product
  for insert to authenticated
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and public.is_workspace_admin()
  );
create policy membership_product_update on public.membership_product
  for update to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and public.is_workspace_admin()
  );

-- Tier↔product links: reached through the tier (Shape B), admin-write.
create policy membership_tier_product_read on public.membership_tier_product
  for select to authenticated
  using (exists (
    select 1 from public.membership_tier t
     where t.id = membership_tier_product.tier_id
       and t.workspace_id = public.current_workspace_id()
       and public.has_app_membership('membership')
  ));
create policy membership_tier_product_write on public.membership_tier_product
  for all to authenticated
  using (exists (
    select 1 from public.membership_tier t
     where t.id = membership_tier_product.tier_id
       and t.workspace_id = public.current_workspace_id()
       and public.has_app_membership('membership')
       and public.is_workspace_admin()
  ))
  with check (exists (
    select 1 from public.membership_tier t
     where t.id = membership_tier_product.tier_id
       and t.workspace_id = public.current_workspace_id()
       and public.has_app_membership('membership')
       and public.is_workspace_admin()
  ));

-- Members: visible to workspace users with the app (the curator-data view
-- that feeds the profile tab); writes are admin-only. The webhook and
-- scheduler write via service role and bypass this — RLS here is the
-- human-session boundary.
create policy membership_member_read on public.membership_member
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and deleted_at is null
  );
create policy membership_member_insert on public.membership_member
  for insert to authenticated
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and public.is_workspace_admin()
  );
create policy membership_member_update on public.membership_member
  for update to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and public.is_workspace_admin()
  );

-- Access grants + the sync journal: admin-only (Shape A / Shape B).
create policy membership_access_grant_scope on public.membership_access_grant
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and public.is_workspace_admin()
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and public.is_workspace_admin()
  );

create policy membership_member_access_scope on public.membership_member_access
  for select to authenticated
  using (exists (
    select 1 from public.membership_member m
     where m.id = membership_member_access.member_id
       and m.workspace_id = public.current_workspace_id()
       and public.has_app_membership('membership')
       and public.is_workspace_admin()
  ));

-- membership_settings: NO authenticated policy on purpose (credential).
-- membership_reminder_send: NO authenticated policy — scheduler-internal.

-- 4 · No workspace bootstrap ------------------------------------------------
-- Deliberately unlike Pulse: Membership is a niche app (communities selling
-- memberships), not a family staple. Activation is the one-click Settings →
-- Apps toggle (routes/workspace-apps.ts), which also grants app_membership.
-- Auto-activating it for every existing workspace would clutter their app
-- lists with a tool most of them will never use.
