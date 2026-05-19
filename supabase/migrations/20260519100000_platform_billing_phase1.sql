-- Platform billing — Phase 1 + Phase 2 + helper.
--
-- Doc:   docs/platform-billing-roadmap.md
-- Phase 1: billing_plan + workspace_subscription tables, seed Free/Pro/Org.
-- Phase 2: every workspace gets a subscription row (free + 'comped' so
--          we never hit Stripe for legacy rows). New workspaces too,
--          via trigger.
-- Helper: workspace_meet_fee_pct(workspace_id) returns the Meet
--         paid-booking fee % — read by the API at Stripe Connect
--         Checkout creation time (Phase 7).
--
-- We do *not* drop the legacy `workspace.plan` text column. Some
-- queries may still reference it; it's now ignored (authoritative
-- source = workspace_subscription).

-- ---------------------------------------------------------------------------
-- billing_plan
-- ---------------------------------------------------------------------------

create table public.billing_plan (
  id                          text primary key,        -- 'free' | 'pro' | 'org'
  name                        text not null,
  price_cents_user_month      integer not null,
  -- Meet paid-booking platform fee % as basis points (1.00 = 100bps = 1%).
  -- Stored as numeric so we have headroom for future fractional tiers.
  meet_paid_pct               numeric(5, 4) not null default 0,
  meet_paid_cap_cents         integer,                 -- nullable = no cap
  features                    jsonb not null default '{}'::jsonb,
  created_at                  timestamptz not null default now()
);

comment on table  public.billing_plan          is 'The three tiers (free / pro / org). Seed-only — no UI edits.';
comment on column public.billing_plan.meet_paid_pct      is 'Platform skim on paid Meet bookings, as a fraction (0.0200 = 2%). 0 = waived.';
comment on column public.billing_plan.meet_paid_cap_cents is 'Per-booking cap in cents. NULL = no cap.';

insert into public.billing_plan (id, name, price_cents_user_month, meet_paid_pct, meet_paid_cap_cents, features) values
  ('free', 'Free', 0,
    0.0200, 200,
    jsonb_build_object(
      'platform_read', true,
      'fibre_meet', true,
      'first_party_apps', false,
      'sso', false,
      'audit_log', false,
      'retention_controls', false,
      'third_party_apps', false,
      'white_labelled_invoices', false,
      'max_users', 1,
      'max_contacts', 100,
      'max_activities_month', 200
    )),
  ('pro', 'Pro', 1500,
    0, null,
    jsonb_build_object(
      'platform_read', true,
      'fibre_meet', true,
      'first_party_apps', true,
      'sso', false,
      'audit_log', false,
      'retention_controls', false,
      'third_party_apps', false,
      'white_labelled_invoices', false,
      'max_users', null,
      'max_contacts', null,
      'max_activities_month', null
    )),
  ('org', 'Org', 3000,
    0, null,
    jsonb_build_object(
      'platform_read', true,
      'fibre_meet', true,
      'first_party_apps', true,
      'sso', true,
      'audit_log', true,
      'retention_controls', true,
      'third_party_apps', true,
      'white_labelled_invoices', true,
      'max_users', null,
      'max_contacts', null,
      'max_activities_month', null
    ));

-- ---------------------------------------------------------------------------
-- workspace_subscription
-- ---------------------------------------------------------------------------

create table public.workspace_subscription (
  workspace_id              uuid primary key references public.workspace(id) on delete cascade,
  plan_id                   text not null references public.billing_plan(id),
  status                    text not null
                              check (status in ('trialing','active','past_due','canceled','incomplete','comped')),
  -- 'comped' = super-admin gave this workspace a plan with no Stripe.
  comped_by                 uuid references public."user"(id),
  comped_reason             text,
  comped_until              timestamptz,
  stripe_customer_id        text,
  stripe_subscription_id    text unique,
  billing_interval          text not null default 'monthly'
                              check (billing_interval in ('monthly','annual')),
  current_period_end        timestamptz,
  cancel_at_period_end      boolean not null default false,
  trial_ends_at             timestamptz,
  seat_count                integer not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index workspace_subscription_status_idx on public.workspace_subscription (status);
create index workspace_subscription_plan_idx   on public.workspace_subscription (plan_id);

alter table public.workspace_subscription enable row level security;

-- Workspace members can read their own subscription. Writes are service-
-- role only (API mutates from Stripe webhooks; no direct UI writes yet).
create policy "workspace_subscription read"
  on public.workspace_subscription
  for select
  to authenticated
  using (
    workspace_id in (
      select wm.workspace_id
        from public.workspace_member wm
       where wm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Backfill — Phase 2.
-- Every existing workspace gets a free + comped row. comped_reason
-- documents this so we know which rows pre-date the billing system.
-- ---------------------------------------------------------------------------

insert into public.workspace_subscription (workspace_id, plan_id, status, comped_reason)
select id, 'free', 'comped', 'pre-billing default (backfilled by 20260519100000)'
  from public.workspace
 where id not in (select workspace_id from public.workspace_subscription);

-- ---------------------------------------------------------------------------
-- Auto-create on new workspace.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_workspace_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_subscription (workspace_id, plan_id, status, comped_reason)
  values (new.id, 'free', 'comped', 'auto-created at workspace insert')
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_workspace_insert_create_subscription on public.workspace;
create trigger on_workspace_insert_create_subscription
  after insert on public.workspace
  for each row execute function public.handle_new_workspace_subscription();

-- ---------------------------------------------------------------------------
-- Helper: workspace's Meet paid-booking fee, as percent + cap.
-- Returns null/null for unknown workspaces (caller treats as no-fee).
-- The API uses this at Connect Checkout Session creation (Phase 7) to
-- compute application_fee_amount.
-- ---------------------------------------------------------------------------

create or replace function public.workspace_meet_fee(ws_id uuid)
returns table (pct numeric, cap_cents integer)
language sql
stable
security definer
set search_path = public
as $$
  select bp.meet_paid_pct, bp.meet_paid_cap_cents
    from public.workspace_subscription ws
    join public.billing_plan bp on bp.id = ws.plan_id
   where ws.workspace_id = ws_id;
$$;

grant execute on function public.workspace_meet_fee(uuid) to authenticated, service_role;
