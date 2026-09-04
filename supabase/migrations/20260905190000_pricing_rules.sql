-- Pricing rules (proposal §3.9, decided 2026-09-04/05): purchasing-power
-- pricing as a RULE layer — kinds are a deploy-time vocabulary, workspaces
-- configure instances as data. First kind: 'region' — config like
-- {"ZA": 75, "AO": 50, "default": 100} (percent of the tier price by the
-- member's SELF-DECLARED country; never IP, never silent).

create table public.membership_pricing_rule (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  -- null = applies to all tiers; a tier-specific rule overrides it.
  tier_id uuid references public.membership_tier(id) on delete cascade,
  kind text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, kind, tier_id)
);
create index membership_pricing_rule_ws on public.membership_pricing_rule (workspace_id);

alter table public.membership_pricing_rule enable row level security;
create policy membership_pricing_rule_read on public.membership_pricing_rule
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
  );
create policy membership_pricing_rule_write on public.membership_pricing_rule
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('membership')
    and (public.is_workspace_admin() or public.has_app_role('membership', 'admin'))
  );

-- The member's self-declared country (ISO 3166-1 alpha-2). Editable on
-- purpose (admin now, member portal later); a change re-resolves the rule
-- FROM THE NEXT RENEWAL — an IP change never touches a price.
alter table public.membership_member
  add column if not exists country text;
