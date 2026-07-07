-- ============================================================================
-- Fibre Pulse — P1: schema + RLS + app registration.
-- docs/fibre-pulse-proposal.md is the spec. Pulse is the 5th in-family app:
-- platform tables (person / organisation / team / workspace / user) are used
-- natively; everything below is Pulse-owned content (pulse_ prefix, public
-- schema — the Flow pattern).
--
-- Role model (proposal §2.4): projection / accounts / budget / settings /
-- reservations are admin+ only. Commitments (the pipeline) are visible to
-- admin+ in full; an organiser sees rows they own (owner_user_id = me).
--
-- Generality principle: nothing domain-specific is hardcoded. Reservation
-- rules (Solidarity Fund, VAT reserve, buffer, …) are user-defined rows.
-- ============================================================================

-- 1. Register the app --------------------------------------------------------

alter table public.app drop constraint if exists app_slug_check;

insert into public.app (slug, name, base_url) values
  ('fibre-pulse', 'Fibre Pulse', 'https://pulse.thefibre.app')
on conflict (slug) do nothing;

alter table public.app
  add constraint app_slug_check
  check (slug in (
    'fibre-platform','fibre-meet','the-thread',
    'fibre-sales','fibre-learn','fibre-flow','fibre-pulse'
  ));

-- 2. Tables ------------------------------------------------------------------

-- 2a. Settings — one row per workspace. The assumptions layer (proposal §2.7).
create table public.pulse_settings (
  workspace_id            uuid primary key references public.workspace(id) on delete cascade,
  currency                text not null default 'EUR',
  default_granularity     text not null default 'fortnight'
                            check (default_granularity in ('week','fortnight','month')),
  period_anchor_date      date,          -- fortnights count from here
  fiscal_year_start_month int not null default 1
                            check (fiscal_year_start_month between 1 and 12),
  horizon_months          int not null default 12
                            check (horizon_months between 1 and 60),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- 2b. Involved teams — which workspace teams take part in the planner
-- (act as hub / incubator). Teams are created + membered at platform level.
create table public.pulse_involved_team (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  team_id       uuid not null references public.team(id) on delete cascade,
  added_at      timestamptz not null default now(),
  unique (workspace_id, team_id)
);

-- 2c. Accounts — bank accounts + reserve buckets (reserves nest under a bank
-- account). Balances arrive as append-only snapshots; the latest anchors the
-- projection. sync_mode 'auto' is reserved for a future bank feed (§2.7).
create table public.pulse_account (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspace(id) on delete cascade,
  name               text not null,
  kind               text not null default 'bank' check (kind in ('bank','reserve')),
  parent_account_id  uuid references public.pulse_account(id) on delete set null,
  sync_mode          text not null default 'manual' check (sync_mode in ('manual','auto')),
  provider_ref       text,
  sort_order         int not null default 0,
  archived_at        timestamptz,
  created_at         timestamptz not null default now()
);
create index pulse_account_workspace_idx on public.pulse_account (workspace_id)
  where archived_at is null;

create table public.pulse_balance_snapshot (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references public.pulse_account(id) on delete cascade,
  balance_cents  bigint not null,
  as_of_date     date not null,
  created_by     uuid references public."user"(id),
  created_at     timestamptz not null default now()
);
create index pulse_balance_snapshot_account_idx
  on public.pulse_balance_snapshot (account_id, as_of_date desc);

-- 2d. Offerings — what the workspace sells. v1 free-standing; a later phase
-- can point one at a thread / meeting type (proposal §3.3).
create table public.pulse_offering (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspace(id) on delete cascade,
  name                  text not null,
  category              text,
  default_amount_cents  bigint,
  notes                 text,
  archived_at           timestamptz,
  created_at            timestamptz not null default now()
);
create index pulse_offering_workspace_idx on public.pulse_offering (workspace_id)
  where archived_at is null;

-- 2e. Projects — run under an involved team (the hub/incubator) or free-
-- standing. A HUB = a team with several projects; an incubator = a team with
-- one project and a few leads. Same shape — the difference is usage.
create table public.pulse_project (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  team_id       uuid references public.team(id) on delete set null,
  name          text not null,
  notes         text,
  archived_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index pulse_project_workspace_idx on public.pulse_project (workspace_id)
  where archived_at is null;

-- 2f. Commitments — an opportunity, from vague lead to firm deal, either
-- direction. The counterparty is a platform contact; the owner is a workspace
-- member. probability weights the projection (committed+ implies 100).
create table public.pulse_commitment (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspace(id) on delete cascade,
  direction        text not null check (direction in ('in','out')),
  person_id        uuid references public.person(id) on delete set null,
  organisation_id  uuid references public.organisation(id) on delete set null,
  team_id          uuid references public.team(id) on delete set null,
  project_id       uuid references public.pulse_project(id) on delete set null,
  offering_id      uuid references public.pulse_offering(id) on delete set null,
  label            text not null,
  owner_user_id    uuid references public."user"(id) on delete set null,
  stage            text not null default 'lead'
                     check (stage in ('lead','proposal','committed','done','cancelled')),
  probability      int not null default 50 check (probability between 0 and 100),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz            -- hard rule #4: soft delete only
);
create index pulse_commitment_workspace_idx on public.pulse_commitment (workspace_id)
  where deleted_at is null;
create index pulse_commitment_owner_idx on public.pulse_commitment (owner_user_id)
  where deleted_at is null;

-- 2g. Commitment lines — the expected payments. Truth-levels: expected
-- (date + amount) → invoiced (invoice_ref/invoiced_at — the REAL sent
-- invoice) → settled (money arrived; purchase_id links the ledger row).
create table public.pulse_commitment_line (
  id             uuid primary key default gen_random_uuid(),
  commitment_id  uuid not null references public.pulse_commitment(id) on delete cascade,
  expected_date  date not null,
  amount_cents   bigint not null,
  invoice_ref    text,
  invoiced_at    date,
  purchase_id    uuid references public.purchase(id) on delete set null,
  settled_at     date,
  created_at     timestamptz not null default now()
);
create index pulse_commitment_line_commitment_idx
  on public.pulse_commitment_line (commitment_id, expected_date);

-- 2h. Budget lines — recurring in/out. Expanded into virtual dated lines at
-- projection time; `included` is the sheet's include toggle.
create table public.pulse_budget_line (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspace(id) on delete cascade,
  label          text not null,
  category       text,
  direction      text not null default 'out' check (direction in ('in','out')),
  amount_cents   bigint not null,
  cadence        text not null default 'monthly'
                   check (cadence in ('weekly','fortnightly','monthly','quarterly','yearly')),
  starts_on      date,
  ends_on        date,
  included       boolean not null default true,
  owner_user_id  uuid references public."user"(id) on delete set null,
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index pulse_budget_line_workspace_idx on public.pulse_budget_line (workspace_id)
  where archived_at is null;

-- 2i. Reservation rules — user-defined %-of-revenue reservations feeding a
-- reserve bucket. VAT is just one of these (an average-savings %), NOT a
-- special-cased concept. Pulse ships with zero built-in rules.
create table public.pulse_reservation_rule (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspace(id) on delete cascade,
  label              text not null,
  percentage         numeric(5,2) not null check (percentage >= 0 and percentage <= 100),
  basis              text not null default 'revenue' check (basis in ('revenue','net_revenue')),
  target_account_id  uuid references public.pulse_account(id) on delete set null,
  included           boolean not null default true,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now()
);
create index pulse_reservation_rule_workspace_idx
  on public.pulse_reservation_rule (workspace_id);

-- 2j. Annual budgets — category targets per quarter; actuals are computed
-- from the purchase ledger + settled lines, never stored.
create table public.pulse_budget (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  year          int not null,
  label         text,
  created_at    timestamptz not null default now(),
  unique (workspace_id, year)
);
create table public.pulse_budget_target (
  id            uuid primary key default gen_random_uuid(),
  budget_id     uuid not null references public.pulse_budget(id) on delete cascade,
  category      text not null,
  direction     text not null default 'in' check (direction in ('in','out')),
  quarter       int not null check (quarter between 1 and 4),
  amount_cents  bigint not null,
  unique (budget_id, category, direction, quarter)
);

-- 3. RLS ---------------------------------------------------------------------

alter table public.pulse_settings          enable row level security;
alter table public.pulse_involved_team     enable row level security;
alter table public.pulse_account           enable row level security;
alter table public.pulse_balance_snapshot  enable row level security;
alter table public.pulse_offering          enable row level security;
alter table public.pulse_project           enable row level security;
alter table public.pulse_commitment        enable row level security;
alter table public.pulse_commitment_line   enable row level security;
alter table public.pulse_budget_line       enable row level security;
alter table public.pulse_reservation_rule  enable row level security;
alter table public.pulse_budget            enable row level security;
alter table public.pulse_budget_target     enable row level security;

-- 3a. Admin-gated workspace tables (proposal §2.4: money surfaces = admin+).
-- One policy shape, applied to each.
create policy pulse_settings_scope on public.pulse_settings
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  );

create policy pulse_involved_team_scope on public.pulse_involved_team
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  );

create policy pulse_account_scope on public.pulse_account
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  );

create policy pulse_balance_snapshot_scope on public.pulse_balance_snapshot
  for all to authenticated
  using (
    public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
    and exists (
      select 1 from public.pulse_account a
       where a.id = pulse_balance_snapshot.account_id
         and a.workspace_id = public.current_workspace_id()
    )
  )
  with check (
    public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
    and exists (
      select 1 from public.pulse_account a
       where a.id = pulse_balance_snapshot.account_id
         and a.workspace_id = public.current_workspace_id()
    )
  );

create policy pulse_budget_line_scope on public.pulse_budget_line
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  );

create policy pulse_reservation_rule_scope on public.pulse_reservation_rule
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  );

create policy pulse_budget_scope on public.pulse_budget
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  );

create policy pulse_budget_target_scope on public.pulse_budget_target
  for all to authenticated
  using (
    public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
    and exists (
      select 1 from public.pulse_budget b
       where b.id = pulse_budget_target.budget_id
         and b.workspace_id = public.current_workspace_id()
    )
  )
  with check (
    public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
    and exists (
      select 1 from public.pulse_budget b
       where b.id = pulse_budget_target.budget_id
         and b.workspace_id = public.current_workspace_id()
    )
  );

-- 3b. Member-visible tables. Offerings + projects are reference data every
-- Pulse member needs to attach an opportunity to; writes stay admin+.
create policy pulse_offering_read on public.pulse_offering
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
  );
create policy pulse_offering_write on public.pulse_offering
  for insert to authenticated
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  );
create policy pulse_offering_update on public.pulse_offering
  for update to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  );

create policy pulse_project_read on public.pulse_project
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
  );
create policy pulse_project_write on public.pulse_project
  for insert to authenticated
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  );
create policy pulse_project_update on public.pulse_project
  for update to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  );

-- 3c. Commitments: admin+ sees all; an organiser sees + edits their own
-- (their deals feed the forecast without exposing salaries or the bank
-- position — proposal §2.4).
create policy pulse_commitment_scope on public.pulse_commitment
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and deleted_at is null
    and (
      public.is_workspace_admin()
      or owner_user_id = public.current_user_id()
    )
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and (
      public.is_workspace_admin()
      or owner_user_id = public.current_user_id()
    )
  );

create policy pulse_commitment_line_scope on public.pulse_commitment_line
  for all to authenticated
  using (
    public.has_app_membership('fibre-pulse')
    and exists (
      select 1 from public.pulse_commitment cm
       where cm.id = pulse_commitment_line.commitment_id
         and cm.workspace_id = public.current_workspace_id()
         and cm.deleted_at is null
         and (
           public.is_workspace_admin()
           or cm.owner_user_id = public.current_user_id()
         )
    )
  )
  with check (
    public.has_app_membership('fibre-pulse')
    and exists (
      select 1 from public.pulse_commitment cm
       where cm.id = pulse_commitment_line.commitment_id
         and cm.workspace_id = public.current_workspace_id()
         and cm.deleted_at is null
         and (
           public.is_workspace_admin()
           or cm.owner_user_id = public.current_user_id()
         )
    )
  );

-- 4. Bootstrap existing workspaces -------------------------------------------
-- Activate Pulse for every workspace and grant app membership to current
-- workspace admins (money surfaces are admin+; organisers get membership via
-- the members UI when their pipeline involvement starts). Flow's activation
-- was done by hand in 2026-05 — this time it's in the migration.

insert into public.workspace_app (workspace_id, app_id, activated_by)
select w.id, a.id, (
  select u.id from public."user" u
   where u.workspace_id = w.id and u.is_super_admin = true
   order by u.created_at asc
   limit 1
)
  from public.workspace w
  cross join public.app a
 where a.slug = 'fibre-pulse'
on conflict (workspace_id, app_id) do nothing;

insert into public.app_membership (user_id, app_id, role)
select wm.user_id, a.id, 'admin'
  from public.workspace_member wm
  join public.app a on a.slug = 'fibre-pulse'
 where wm.workspace_role in ('admin','super_admin')
on conflict (user_id, app_id) do nothing;
