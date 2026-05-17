-- ============================================================================
-- Rename meet_team → team and meet_team_member → team_member.
--
-- Rationale: teams are a Fibre primitive, not a Meet-private one. Sibling
-- apps (Flow next, others later) consume them natively. Keeping the
-- `meet_` prefix would force every in-family app to reach into Meet's
-- namespace for a concept that doesn't belong to Meet. See
-- docs/fibreflow-review.md §2.2.
--
-- Strategy: rename tables, indexes, triggers, policies in place. FK
-- constraints follow by OID; RLS policy expressions on other tables
-- (meet_booking_visibility, can_see_person, etc.) also follow by OID so
-- they continue to work — but we re-create can_see_person so its source
-- text stays canonical (pg_dump output, future readers).
-- ============================================================================

-- 1. Tables
alter table public.meet_team        rename to team;
alter table public.meet_team_member rename to team_member;

-- 2. Indexes
alter index public.meet_team_workspace_idx        rename to team_workspace_idx;
alter index public.meet_team_member_user_idx      rename to team_member_user_idx;
alter index public.meet_team_member_invite_token_uq rename to team_member_invite_token_uq;

-- 3. Triggers (on the renamed tables)
alter trigger meet_team_root_slug_sync on public.team rename to team_root_slug_sync;
alter trigger meet_team_updated_at     on public.team rename to team_updated_at;

-- 4. Policies (renamed in place; expressions reference tables by OID so the
-- subqueries inside continue to work even though they textually still say
-- "public.meet_team" until pg_dump regenerates them).
alter policy meet_team_scope         on public.team        rename to team_scope;
alter policy meet_team_member_read   on public.team_member rename to team_member_read;
alter policy meet_team_member_insert on public.team_member rename to team_member_insert;
alter policy meet_team_member_update on public.team_member rename to team_member_update;
alter policy meet_team_member_delete on public.team_member rename to team_member_delete;

-- 5. Re-create can_see_person with new table names in its body, so the
-- source text is canonical. (The OID-based reference would survive a rename,
-- but pg_dump shows the function source verbatim.)
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
    when (select workspace_role from me) = 'admin' then true
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

-- 6. Re-create meet_booking_visibility so its source text is canonical.
-- Same expression as before with renamed tables.
drop policy if exists meet_booking_visibility on public.meet_booking;
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
          join public.team_member tm on tm.team_id = mt.team_id
         where mt.id = meet_booking.meeting_type_id
           and tm.user_id = public.current_user_id()
           and tm.status  = 'active'
      )
      or exists (
        select 1 from public.meet_meeting_type mt
          join public.team t on t.id = mt.team_id
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

-- 7. Refresh public.meet_is_team_lead body so it queries team_member (was
-- meet_team_member). Function name kept as-is to avoid touching every RLS
-- policy that references it by OID — the prefix is historical baggage we
-- can drop in a later cleanup pass.
create or replace function public.meet_is_team_lead(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.team_member
     where team_id = p_team_id
       and user_id = public.current_user_id()
       and role = 'lead'
  )
$$;

-- 8. Update app_entity_mapping seed row that names 'meet_team_member' as the
-- app_entity. With teams now being platform-owned, this mapping is no longer
-- conceptually correct (team_member IS a platform entity), but the row
-- exists from migration 20260517100000. We tighten the entity name to match
-- the renamed table.
update public.app_entity_mapping
   set app_entity = 'team_member'
 where app_entity = 'meet_team_member';
