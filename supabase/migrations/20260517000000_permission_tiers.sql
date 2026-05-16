-- ============================================================================
-- Permission tiers slice (v0.9.0)
--
-- Adds per-(user, workspace) attributes and per-resource visibility, so a
-- workspace can have admins + members + internal + external users without
-- everyone seeing the entire contact graph.
--
-- Pinned decisions (see docs/permission-tiers-proposal.md):
--   * workspace_member table (multi-org ready)
--   * workspace_role: admin | member
--   * relationship_type: internal | external
--   * Per-resource visibility on meet_team + program: members_only | org_wide
--   * can_see_person() + can_see_activity() SECURITY DEFINER helpers
--
-- BACKWARDS COMPAT: every existing user is backfilled as (workspace_role
-- inferred from their fibre-platform app_membership.role; relationship_type
-- 'internal'). Every existing meet_team + program is 'members_only'. The
-- existing single-admin sjoerd@soul.com workspace sees no behavioural change.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. workspace_member pivot
-- ---------------------------------------------------------------------------
create table public.workspace_member (
  user_id            uuid not null references public."user"(id) on delete cascade,
  workspace_id       uuid not null references public.workspace(id) on delete cascade,
  workspace_role     text not null default 'member'
                       check (workspace_role in ('admin','member')),
  relationship_type  text not null default 'internal'
                       check (relationship_type in ('internal','external')),
  member_status      text,           -- cosmetic label; no permission effect
  joined_at          timestamptz not null default now(),
  primary key (user_id, workspace_id)
);
create index workspace_member_workspace_idx on public.workspace_member (workspace_id);

-- ---------------------------------------------------------------------------
-- 2. visibility on resource types
-- ---------------------------------------------------------------------------
alter table public.meet_team
  add column if not exists visibility text not null default 'members_only'
    check (visibility in ('members_only','org_wide'));

alter table public.program
  add column if not exists visibility text not null default 'members_only'
    check (visibility in ('members_only','org_wide'));

-- ---------------------------------------------------------------------------
-- 3. Backfill workspace_member from existing data
-- ---------------------------------------------------------------------------
insert into public.workspace_member (user_id, workspace_id, workspace_role, relationship_type)
select
  u.id,
  u.workspace_id,
  case
    when exists (
      select 1
        from public.app_membership am
        join public.app a on a.id = am.app_id
       where am.user_id = u.id
         and a.slug = 'fibre-platform'
         and am.role = 'admin'
    ) then 'admin'
    else 'member'
  end as workspace_role,
  'internal' as relationship_type
from public."user" u
where u.deleted_at is null
on conflict (user_id, workspace_id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Convenience helper for admin check (used by RLS shortcuts).
-- SECURITY DEFINER so it can read workspace_member without recursion.
-- ---------------------------------------------------------------------------
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
       and wm.workspace_role = 'admin'
  )
$$;

-- ---------------------------------------------------------------------------
-- 5. can_see_person(p_person_id)
--
-- True if the calling user is allowed to see this person row. Five clauses:
--   a) admin shortcut
--   b) self (their own person row)
--   c) share an active Meet team membership
--   d) share an enrolment in a program
--   e) person is in an org_wide Meet team / program AND I'm internal
--   f) I hosted a Meet booking where they were the invitee
-- ---------------------------------------------------------------------------
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
    -- workspace match always required
    when (select workspace_id from target) is distinct from (select current_workspace_id())
      then false
    -- admin
    when (select workspace_role from me) = 'admin' then true
    -- self
    when (select person_id from me) = p_person_id then true
    -- shared active Meet team
    when exists (
      select 1
        from public.meet_team_member tm1
        join public.meet_team_member tm2 on tm2.team_id = tm1.team_id
        join public."user" u2 on u2.id = tm2.user_id
       where tm1.user_id = (select user_id from me)
         and tm1.status  = 'active'
         and tm2.status  = 'active'
         and u2.person_id = p_person_id
    ) then true
    -- shared program enrolment
    when exists (
      select 1
        from public.enrolment e1
        join public.enrolment e2 on e1.program_id = e2.program_id
       where e1.person_id = (select person_id from me)
         and e2.person_id = p_person_id
    ) then true
    -- person is in an org_wide Meet team AND I'm internal
    when (select relationship_type from me) = 'internal' and exists (
      select 1
        from public.meet_team t
        join public.meet_team_member tm on tm.team_id = t.id
        join public."user" u on u.id = tm.user_id
       where t.visibility   = 'org_wide'
         and t.workspace_id = public.current_workspace_id()
         and u.person_id    = p_person_id
         and tm.status      = 'active'
    ) then true
    -- person is in an org_wide program AND I'm internal
    when (select relationship_type from me) = 'internal' and exists (
      select 1
        from public.program p
        join public.enrolment e on e.program_id = p.id
       where p.visibility   = 'org_wide'
         and p.workspace_id = public.current_workspace_id()
         and e.person_id    = p_person_id
    ) then true
    -- I hosted a Meet booking with them
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

-- ---------------------------------------------------------------------------
-- 6. can_see_organisation(p_org_id)
--
-- True if the calling user can see ANY person who's a member of this org,
-- OR is an admin. Conservative — externals only see orgs whose people they
-- can already see; internals see every org in the workspace (since orgs
-- are an org-wide directory by definition).
-- ---------------------------------------------------------------------------
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
    when (select workspace_role from me) = 'admin' then true
    when (select relationship_type from me) = 'internal' then true
    -- external: any member of the org I can see
    when exists (
      select 1
        from public.org_membership om
       where om.org_id = p_org_id
         and public.can_see_person(om.person_id)
    ) then true
    else false
  end
$$;

-- ---------------------------------------------------------------------------
-- 7. can_see_activity(p_activity_id)
--
-- Activity has a non-null person_id. Visibility = can-see-that-person.
-- Activity-only-on-org rows would need a separate clause; today they
-- don't exist (the schema requires person_id).
-- ---------------------------------------------------------------------------
create or replace function public.can_see_activity(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with a as (
    select person_id, workspace_id from public.activity where id = p_activity_id
  )
  select case
    when (select workspace_id from a) is distinct from (select current_workspace_id())
      then false
    when public.is_workspace_admin() then true
    when (select person_id from a) is not null
      then public.can_see_person((select person_id from a))
    else false
  end
$$;

revoke all on function public.is_workspace_admin   from public;
revoke all on function public.can_see_person       from public;
revoke all on function public.can_see_organisation from public;
revoke all on function public.can_see_activity     from public;
grant execute on function public.is_workspace_admin   to authenticated;
grant execute on function public.can_see_person       to authenticated;
grant execute on function public.can_see_organisation to authenticated;
grant execute on function public.can_see_activity     to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Replace RLS on public.person to use the helper.
-- The previous policy was just workspace-scoped; we keep the workspace
-- predicate (cheap pre-filter) and AND it with can_see_person.
-- ---------------------------------------------------------------------------
drop policy if exists person_workspace on public.person;
create policy person_visibility on public.person
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.can_see_person(id)
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.can_see_person(id)
  );

-- ---------------------------------------------------------------------------
-- 9. Replace RLS on public.organisation similarly.
-- ---------------------------------------------------------------------------
drop policy if exists org_workspace on public.organisation;
create policy organisation_visibility on public.organisation
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.can_see_organisation(id)
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.can_see_organisation(id)
  );

-- ---------------------------------------------------------------------------
-- 10. Activity: tighten the SELECT policy. Keep the INSERT policy alone
-- (services + apps need to write activities; the policy already requires
-- workspace match + matching app_id).
-- ---------------------------------------------------------------------------
drop policy if exists activity_workspace_select on public.activity;
create policy activity_visibility on public.activity
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.can_see_activity(id)
  );

-- ---------------------------------------------------------------------------
-- 11. Meet booking: only see bookings if (a) I'm the host, (b) I'm a member
-- of the MT's team, (c) the MT's team is org_wide and I'm internal, or
-- (d) I'm an org admin.
-- ---------------------------------------------------------------------------
drop policy if exists meet_booking_scope on public.meet_booking;
create policy meet_booking_visibility on public.meet_booking
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
    and (
      public.is_workspace_admin()
      or exists (
        select 1 from public.meet_host h
         where h.id = meet_booking.host_id
           and h.user_id = public.current_user_id()
      )
      or exists (
        select 1 from public.meet_meeting_type mt
          join public.meet_team_member tm on tm.team_id = mt.team_id
         where mt.id = meet_booking.meeting_type_id
           and tm.user_id = public.current_user_id()
           and tm.status  = 'active'
      )
      or exists (
        select 1 from public.meet_meeting_type mt
          join public.meet_team t on t.id = mt.team_id
          join public.workspace_member wm
            on wm.user_id = public.current_user_id()
           and wm.workspace_id = public.current_workspace_id()
         where mt.id = meet_booking.meeting_type_id
           and t.visibility = 'org_wide'
           and wm.relationship_type = 'internal'
      )
    )
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
  );

-- ---------------------------------------------------------------------------
-- 12. RLS on workspace_member itself.
--   SELECT: every workspace member can see the roster.
--   INSERT/UPDATE/DELETE: admin only.
-- ---------------------------------------------------------------------------
alter table public.workspace_member enable row level security;

create policy workspace_member_read on public.workspace_member
  for select to authenticated
  using (workspace_id = public.current_workspace_id());

create policy workspace_member_write on public.workspace_member
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.is_workspace_admin()
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.is_workspace_admin()
  );

-- ---------------------------------------------------------------------------
-- 13. Updated-at trigger on workspace_member (no-op for now — table doesn't
-- have updated_at — but reserved for future).
-- ---------------------------------------------------------------------------
-- (intentional no-op)
