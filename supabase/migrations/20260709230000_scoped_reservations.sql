-- Reservations per cashflow (Sjoerd 2026-07-09: "so I can create bank and
-- reservations per cashflow?") — rules gain the same scope as accounts:
-- workspace (both null), a team's, or personal.
alter table public.pulse_reservation_rule
  add column if not exists team_id uuid references public.team(id) on delete cascade,
  add column if not exists owner_user_id uuid references public."user"(id) on delete cascade;

drop policy if exists pulse_reservation_rule_scope on public.pulse_reservation_rule;
create policy pulse_reservation_rule_scope on public.pulse_reservation_rule
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
