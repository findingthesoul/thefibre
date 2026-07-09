-- ============================================================================
-- Cashflow tabs, each with its own bank (Sjoerd 2026-07-09 morning, pt 1+3):
-- accounts gain a scope — workspace (both null), a team's virtual bank
-- (team_id), or a personal one (owner_user_id). A team cashflow "exists"
-- once its lead creates a bank for it. Plus the focus date: the first
-- column of the cashflow starts on a chosen weekday (e.g. first upcoming
-- Friday).
-- ============================================================================

alter table public.pulse_account
  add column if not exists team_id uuid references public.team(id) on delete cascade,
  add column if not exists owner_user_id uuid references public."user"(id) on delete cascade;

-- Personal accounts: their owner sees + manages them even without admin.
drop policy if exists pulse_account_scope on public.pulse_account;
create policy pulse_account_scope on public.pulse_account
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and (public.is_workspace_admin() or owner_user_id = public.current_user_id())
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and (public.is_workspace_admin() or owner_user_id = public.current_user_id())
  );

drop policy if exists pulse_balance_snapshot_scope on public.pulse_balance_snapshot;
create policy pulse_balance_snapshot_scope on public.pulse_balance_snapshot
  for all to authenticated
  using (
    public.has_app_membership('fibre-pulse')
    and exists (
      select 1 from public.pulse_account a
       where a.id = pulse_balance_snapshot.account_id
         and a.workspace_id = public.current_workspace_id()
         and (public.is_workspace_admin() or a.owner_user_id = public.current_user_id())
    )
  )
  with check (
    public.has_app_membership('fibre-pulse')
    and exists (
      select 1 from public.pulse_account a
       where a.id = pulse_balance_snapshot.account_id
         and a.workspace_id = public.current_workspace_id()
         and (public.is_workspace_admin() or a.owner_user_id = public.current_user_id())
    )
  );

-- Focus date: the cashflow's first column lands on this weekday (1=Mon …
-- 7=Sun, ISO). Null = start today (current behaviour).
alter table public.pulse_settings
  add column if not exists focus_weekday int
    check (focus_weekday is null or focus_weekday between 1 and 7);
