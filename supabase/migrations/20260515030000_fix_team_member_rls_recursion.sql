-- Fix infinite recursion on meet_team_member RLS.
--
-- The original write policy used `exists (… join meet_team_member tm …)`
-- inside its USING clause, and because it was declared `FOR ALL`, every
-- SELECT also evaluated that USING — triggering recursive evaluation of
-- meet_team_member's own policy.
--
-- Resolution: a SECURITY DEFINER helper that checks lead-ness without RLS,
-- and split policies so SELECT and write use cleanly separate, non-recursive
-- clauses.

create or replace function public.meet_is_team_lead(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.meet_team_member
     where team_id = p_team_id
       and user_id = public.current_user_id()
       and role = 'lead'
  )
$$;

-- Drop the recursive policies and recreate them using the helper.
drop policy if exists meet_team_member_read on public.meet_team_member;
drop policy if exists meet_team_member_write on public.meet_team_member;

-- Read: anyone with fibre-meet in this workspace can see memberships of
-- teams that live in this workspace. The team-lookup goes through meet_team
-- (its policy is non-recursive), so this read does NOT touch meet_team_member.
create policy meet_team_member_read on public.meet_team_member
  for select to authenticated
  using (
    public.has_app_membership('fibre-meet')
    and exists (
      select 1 from public.meet_team t
       where t.id = meet_team_member.team_id
         and t.workspace_id = public.current_workspace_id()
    )
  );

-- Insert / Update / Delete: must be a lead of this specific team. The check
-- runs through the SECURITY DEFINER helper, which queries meet_team_member
-- with row-security bypassed — no recursion.
create policy meet_team_member_insert on public.meet_team_member
  for insert to authenticated
  with check (
    public.has_app_membership('fibre-meet')
    and public.meet_is_team_lead(team_id)
  );

create policy meet_team_member_update on public.meet_team_member
  for update to authenticated
  using (
    public.has_app_membership('fibre-meet')
    and public.meet_is_team_lead(team_id)
  )
  with check (
    public.has_app_membership('fibre-meet')
    and public.meet_is_team_lead(team_id)
  );

create policy meet_team_member_delete on public.meet_team_member
  for delete to authenticated
  using (
    public.has_app_membership('fibre-meet')
    and public.meet_is_team_lead(team_id)
  );
