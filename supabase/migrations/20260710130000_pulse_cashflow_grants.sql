-- ============================================================================
-- Per-person Workspace cashflow grants (Sjoerd 2026-07-10: share the company
-- cashflow with someone read or read-write, without making them a full admin
-- — the middle ground his tab spec asked for). A super-admin/admin grants a
-- workspace member 'read' or 'write' on the Workspace cashflow.
--
-- Enforced by ADDITIVE RLS policies: the existing admin-or-owner policies
-- stay; these OR in extra visibility/write for grantees on WORKSPACE-scoped
-- rows only (personal=false, no team). Team + personal cashflows are
-- unaffected.
-- ============================================================================

create table public.pulse_cashflow_grant (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  user_id       uuid not null references public."user"(id) on delete cascade,
  level         text not null check (level in ('read', 'write')),
  granted_by    uuid references public."user"(id),
  created_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);
alter table public.pulse_cashflow_grant enable row level security;

-- Admins manage grants; a user may see their own grant row.
create policy pulse_cashflow_grant_admin on public.pulse_cashflow_grant
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and (public.is_workspace_admin() or user_id = public.current_user_id())
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  );

-- Helpers: does the current user have a workspace-cashflow grant?
create or replace function public.pulse_can_read_workspace()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_workspace_admin() or exists (
    select 1 from public.pulse_cashflow_grant g
     where g.workspace_id = public.current_workspace_id()
       and g.user_id = public.current_user_id()
  )
$$;
create or replace function public.pulse_can_write_workspace()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_workspace_admin() or exists (
    select 1 from public.pulse_cashflow_grant g
     where g.workspace_id = public.current_workspace_id()
       and g.user_id = public.current_user_id()
       and g.level = 'write'
  )
$$;

-- Settings are needed to render any cashflow (rhythm, currency, VAT) and
-- aren't sensitive — let any Pulse member READ them (writes stay admin).
drop policy if exists pulse_settings_scope on public.pulse_settings;
create policy pulse_settings_read on public.pulse_settings
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
  );
create policy pulse_settings_write on public.pulse_settings
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

-- Commitments (workspace-scoped): grantees read; write-grantees write.
create policy pulse_commitment_ws_read on public.pulse_commitment
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and deleted_at is null
    and personal = false and team_id is null
    and public.pulse_can_read_workspace()
  );
create policy pulse_commitment_ws_write on public.pulse_commitment
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and personal = false and team_id is null
    and public.pulse_can_write_workspace()
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and personal = false and team_id is null
    and public.pulse_can_write_workspace()
  );

-- Commitment lines + items: readable/writable when their parent commitment is.
create policy pulse_commitment_line_ws on public.pulse_commitment_line
  for all to authenticated
  using (
    public.has_app_membership('fibre-pulse')
    and exists (
      select 1 from public.pulse_commitment cm
       where cm.id = pulse_commitment_line.commitment_id
         and cm.workspace_id = public.current_workspace_id()
         and cm.personal = false and cm.team_id is null
         and cm.deleted_at is null
         and public.pulse_can_read_workspace()
    )
  )
  with check (
    public.has_app_membership('fibre-pulse')
    and exists (
      select 1 from public.pulse_commitment cm
       where cm.id = pulse_commitment_line.commitment_id
         and cm.workspace_id = public.current_workspace_id()
         and cm.personal = false and cm.team_id is null
         and public.pulse_can_write_workspace()
    )
  );
create policy pulse_commitment_item_ws on public.pulse_commitment_item
  for all to authenticated
  using (
    public.has_app_membership('fibre-pulse')
    and exists (
      select 1 from public.pulse_commitment cm
       where cm.id = pulse_commitment_item.commitment_id
         and cm.workspace_id = public.current_workspace_id()
         and cm.personal = false and cm.team_id is null
         and cm.deleted_at is null
         and public.pulse_can_read_workspace()
    )
  )
  with check (
    public.has_app_membership('fibre-pulse')
    and exists (
      select 1 from public.pulse_commitment cm
       where cm.id = pulse_commitment_item.commitment_id
         and cm.workspace_id = public.current_workspace_id()
         and cm.personal = false and cm.team_id is null
         and public.pulse_can_write_workspace()
    )
  );

-- Workspace accounts + snapshots, reservation rules, budget lines.
create policy pulse_account_ws_read on public.pulse_account
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and team_id is null and owner_user_id is null
    and public.pulse_can_read_workspace()
  );
create policy pulse_account_ws_write on public.pulse_account
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and team_id is null and owner_user_id is null
    and public.pulse_can_write_workspace()
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and team_id is null and owner_user_id is null
    and public.pulse_can_write_workspace()
  );
create policy pulse_snapshot_ws on public.pulse_balance_snapshot
  for all to authenticated
  using (
    public.has_app_membership('fibre-pulse')
    and exists (
      select 1 from public.pulse_account a
       where a.id = pulse_balance_snapshot.account_id
         and a.workspace_id = public.current_workspace_id()
         and a.team_id is null and a.owner_user_id is null
         and public.pulse_can_read_workspace()
    )
  )
  with check (
    public.has_app_membership('fibre-pulse')
    and exists (
      select 1 from public.pulse_account a
       where a.id = pulse_balance_snapshot.account_id
         and a.workspace_id = public.current_workspace_id()
         and a.team_id is null and a.owner_user_id is null
         and public.pulse_can_write_workspace()
    )
  );
create policy pulse_reservation_rule_ws_read on public.pulse_reservation_rule
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and team_id is null and owner_user_id is null
    and public.pulse_can_read_workspace()
  );
create policy pulse_reservation_rule_ws_write on public.pulse_reservation_rule
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and team_id is null and owner_user_id is null
    and public.pulse_can_write_workspace()
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and team_id is null and owner_user_id is null
    and public.pulse_can_write_workspace()
  );
create policy pulse_budget_line_ws_read on public.pulse_budget_line
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and team_id is null
    and public.pulse_can_read_workspace()
  );
create policy pulse_budget_line_ws_write on public.pulse_budget_line
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and team_id is null
    and public.pulse_can_write_workspace()
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and team_id is null
    and public.pulse_can_write_workspace()
  );
