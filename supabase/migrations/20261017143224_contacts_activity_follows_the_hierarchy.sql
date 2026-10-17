-- ============================================================================
-- What you see about a contact follows the hierarchy too (contacts, slice 2,
-- step 4; Sjoerd, 2026-10-17: "I can only see what those contacts have done
-- in relation to my organisation, not the whole workspace").
--
-- ⚠ NOT TO PRODUCTION BEFORE THE PROD BACKFILL HAS RUN
--   (apps/api/scripts/backfill-activity-refs.ts prod --apply). Until then old
--   Thread / Meet rows have no ref, and organisers would lose their
--   participants' history the moment this lands.
--
-- Until now can_see_activity was can_see_person: once a person was visible,
-- their WHOLE workspace timeline was. Now an activity row is visible when:
--   · you are admin / super_admin                       (as before)
--   · it is about yourself
--   · you wrote it (created_by) — notes and Flow runs (Sjoerd's answer ii)
--   · its activity_ref is a THREAD you hold a role on now — its organiser, a
--     host or a facilitator — or one that belongs to a team you are an active
--     member of
--   · its activity_ref is a MEET BOOKING you host, or of a meeting type you
--     are assigned to or your team owns
-- and nothing else. A row with no ref — membership, Drive, profile, an
-- external app's row, an old row the backfill could not match — is admins
-- only (plus its author and its subject). The same hierarchy as
-- can_see_person (20261017133142), applied to the row's own thread or booking
-- rather than to any thread the person is on: being someone's organiser on
-- thread X does not show you what they did on thread Y.
--
-- Same signature, so `create or replace` keeps the owner and the grants of
-- the born-closed migration (20260914171000). activity_ref is read here, as
-- the definer, and stays unreadable to every signed-in user.
-- ============================================================================

create or replace function public.can_see_activity(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with a as (
    select id, person_id, workspace_id, created_by
      from public.activity
     where id = p_activity_id
  ),
  me as (
    select u.id as user_id, u.person_id
      from public."user" u
     where u.id = public.current_user_id()
  ),
  r as (
    select ref_kind, ref_id
      from public.activity_ref
     where activity_id = p_activity_id
  )
  select case
    when (select workspace_id from a) is distinct from (select current_workspace_id())
      then false
    when public.is_workspace_admin() then true
    when (select person_id from a) = (select person_id from me) then true
    when (select created_by from a) is not null
     and (select created_by from a) = (select user_id from me) then true
    -- A thread you organise, host or facilitate.
    when (select ref_kind from r) = 'thread' and exists (
      select 1
        from public.thread_thread t
        join public.thread_organiser o on o.id = t.organiser_id
       where t.id = (select ref_id from r)
         and o.user_id = (select user_id from me)
    ) then true
    when (select ref_kind from r) = 'thread' and exists (
      select 1
        from public.thread_thread_organiser tto
        join public.thread_organiser o on o.id = tto.organiser_id
       where tto.thread_id = (select ref_id from r)
         and o.user_id     = (select user_id from me)
    ) then true
    -- A thread that belongs to your team.
    when (select ref_kind from r) = 'thread' and exists (
      select 1
        from public.thread_thread t
        join public.team_member tm on tm.team_id = t.team_id
       where t.id       = (select ref_id from r)
         and tm.user_id = (select user_id from me)
         and tm.status  = 'active'
    ) then true
    -- A booking you host.
    when (select ref_kind from r) = 'meet_booking' and exists (
      select 1
        from public.meet_booking b
        join public.meet_host h on h.id = b.host_id
       where b.id      = (select ref_id from r)
         and h.user_id = (select user_id from me)
    ) then true
    -- A booking of a type you are assigned to, or that your team owns.
    when (select ref_kind from r) = 'meet_booking' and exists (
      select 1
        from public.meet_booking b
        join public.meet_meeting_type mt on mt.id = b.meeting_type_id
       where b.id = (select ref_id from r)
         and (
           exists (
             select 1 from public.meet_meeting_type_assignee x
              where x.meeting_type_id = mt.id
                and x.user_id         = (select user_id from me)
           )
           or exists (
             select 1 from public.team_member tm
              where tm.team_id = mt.team_id
                and tm.user_id = (select user_id from me)
                and tm.status  = 'active'
           )
         )
    ) then true
    else false
  end
$$;
