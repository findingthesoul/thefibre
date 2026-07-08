-- ============================================================================
-- Teams are a platform primitive — fix the RLS leftover from their Meet era.
--
-- team_scope / team_member_read (renamed from meet_team_* in 20260517220000)
-- still required has_app_membership('fibre-meet') to SEE teams at all. That
-- made the team list differ per app doorway (Sjoerd, 2026-07-07: "the team
-- is not the same as in thread or meet") and would show a Pulse-only user
-- an empty picker. Teams belong to the workspace: any workspace member may
-- see its teams and their membership. Mutations keep their existing gates
-- (leads / admin / fibre-meet), unchanged in behaviour.
-- ============================================================================

-- 1. team: split the all-in-one policy. Read = workspace. Write = what the
--    old policy allowed (fibre-meet) plus workspace admins.
drop policy if exists team_scope on public.team;

create policy team_read on public.team
  for select to authenticated
  using (workspace_id = public.current_workspace_id());

create policy team_write on public.team
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and (public.is_workspace_admin() or public.has_app_membership('fibre-meet'))
  )
  with check (
    workspace_id = public.current_workspace_id()
    and (public.is_workspace_admin() or public.has_app_membership('fibre-meet'))
  );

-- 2. team_member: read = workspace (member counts / rosters visible to any
--    workspace member). The lead-gated write policy stays as-is.
drop policy if exists team_member_read on public.team_member;

create policy team_member_read on public.team_member
  for select to authenticated
  using (
    exists (
      select 1 from public.team t
       where t.id = team_member.team_id
         and t.workspace_id = public.current_workspace_id()
    )
  );
