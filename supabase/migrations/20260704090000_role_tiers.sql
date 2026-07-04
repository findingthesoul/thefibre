-- ============================================================================
-- Role tiers (Invoices proposal §2.3, decisions D1-D4 accepted 2026-07-04):
--   workspace_role: super_admin | admin | organiser
-- Renames 'member' → 'organiser' ("every account is an organiser at minimum")
-- and promotes the earliest-joined admin of each workspace to super_admin.
-- Facilitator stays a per-object role (thread_thread_organiser) — it is NOT
-- a workspace role.
-- ============================================================================

-- 1. Widen the check, migrate the data, tighten again.
alter table public.workspace_member
  drop constraint if exists workspace_member_workspace_role_check;

update public.workspace_member set workspace_role = 'organiser'
 where workspace_role = 'member';

-- Earliest admin per workspace becomes super_admin (workspace owner).
with firsts as (
  select distinct on (workspace_id) user_id, workspace_id
    from public.workspace_member
   where workspace_role = 'admin'
   order by workspace_id, joined_at asc
)
update public.workspace_member wm
   set workspace_role = 'super_admin'
  from firsts f
 where wm.user_id = f.user_id and wm.workspace_id = f.workspace_id;

alter table public.workspace_member
  add constraint workspace_member_workspace_role_check
  check (workspace_role in ('super_admin','admin','organiser'));

alter table public.workspace_member
  alter column workspace_role set default 'organiser';

-- 2. Helper: the caller's role in the current workspace (for RLS + API).
create or replace function public.current_workspace_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select wm.workspace_role
    from public.workspace_member wm
   where wm.user_id      = public.current_user_id()
     and wm.workspace_id = public.current_workspace_id()
$$;
revoke all on function public.current_workspace_role from public;
grant execute on function public.current_workspace_role to authenticated;

-- 3. is_workspace_admin now means admin-or-above.
create or replace function public.is_workspace_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.workspace_member wm
     where wm.user_id      = public.current_user_id()
       and wm.workspace_id = public.current_workspace_id()
       and wm.workspace_role in ('admin','super_admin')
  )
$$;

-- 4. Re-create can_see_person with the widened admin clause (canonical body
-- from 20260517220000, only the role check changes).
create or replace function public.can_see_person(p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select u.id          as user_id,
           u.person_id   as person_id,
           wm.workspace_role,
           wm.relationship_type
      from public."user" u
      left join public.workspace_member wm
             on wm.user_id      = u.id
            and wm.workspace_id = u.workspace_id
     where u.id = public.current_user_id()
  ),
  target as (
    select id, workspace_id from public.person where id = p_person_id
  )
  select case
    when (select workspace_id from target) is distinct from (select current_workspace_id())
      then false
    when (select workspace_role from me) in ('admin','super_admin') then true
    when (select person_id from me) = p_person_id then true
    when exists (
      select 1
        from public.team_member tm1
        join public.team_member tm2 on tm2.team_id = tm1.team_id
        join public."user" u2 on u2.id = tm2.user_id
       where tm1.user_id = (select user_id from me)
         and tm1.status  = 'active'
         and tm2.status  = 'active'
         and u2.person_id = p_person_id
    ) then true
    when exists (
      select 1
        from public.enrolment e1
        join public.enrolment e2 on e1.program_id = e2.program_id
       where e1.person_id = (select person_id from me)
         and e2.person_id = p_person_id
    ) then true
    when (select relationship_type from me) = 'internal' and exists (
      select 1
        from public.team t
        join public.team_member tm on tm.team_id = t.id
        join public."user" u on u.id = tm.user_id
       where t.visibility   = 'org_wide'
         and t.workspace_id = public.current_workspace_id()
         and u.person_id    = p_person_id
         and tm.status      = 'active'
    ) then true
    when (select relationship_type from me) = 'internal' and exists (
      select 1
        from public.program p
        join public.enrolment e on e.program_id = p.id
       where p.visibility   = 'org_wide'
         and p.workspace_id = public.current_workspace_id()
         and e.person_id    = p_person_id
    ) then true
    when exists (
      select 1
        from public.meet_booking b
        join public.meet_host h on h.id = b.host_id
       where b.invitee_person_id = p_person_id
         and h.user_id           = (select user_id from me)
    ) then true
    else false
  end
$$;

-- 5. Same widening for can_see_organisation.
create or replace function public.can_see_organisation(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select wm.workspace_role, wm.relationship_type
      from public.workspace_member wm
     where wm.user_id      = public.current_user_id()
       and wm.workspace_id = public.current_workspace_id()
  ),
  target as (
    select id, workspace_id from public.organisation where id = p_org_id
  )
  select case
    when (select workspace_id from target) is distinct from (select current_workspace_id())
      then false
    when (select workspace_role from me) in ('admin','super_admin') then true
    when (select relationship_type from me) = 'internal' then true
    when exists (
      select 1
        from public.org_membership om
       where om.org_id = p_org_id
         and public.can_see_person(om.person_id)
    ) then true
    else false
  end
$$;
