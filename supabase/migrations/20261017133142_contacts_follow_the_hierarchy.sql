-- ============================================================================
-- Fibre Contacts follow the hierarchy (Sjoerd, 2026-10-17: "yes contacts").
--
-- WHO a signed-in staff user sees in Contacts is can_see_person — the person
-- table's row policy (person_select / person_update) calls it, and Contacts
-- reads through RLS (routes/persons.ts, userClient). His model is a
-- hierarchy, each level seeing what is below it:
--
--   workspace admin → team → organiser → host / facilitator
--
-- So a person in your workspace is visible when:
--   · you are admin / super_admin                               (unchanged)
--   · it is you                                                 (unchanged)
--   · they are an active teammate — staff seeing staff          (unchanged)
--   · NEW they are enrolled (any status) in a thread you hold a role on NOW:
--       its primary organiser (thread_thread.organiser_id), or a host /
--       facilitator on it (thread_thread_organiser). Stepping off loses it.
--   · NEW they are enrolled in a thread whose team you are an active member of.
--   · Meet: you host their booking                              (unchanged)
--     NEW or you are an assignee of its meeting type, or an active member of
--     the team that owns the type (round robin and collective types are
--     always team-owned — meet_meeting_type_team_only_multihost).
--   · internal + an org_wide team / program                     (unchanged:
--     both are explicit settings, default members_only)
--
-- REMOVED: the fellow-participant clause. Sharing a program showed the whole
-- program to every participant who held a Fibre account; nothing in the
-- hierarchy asks for that.
--
-- The workspace role 'organiser' gives no contacts by itself — only a role on
-- a thread does (Sjoerd's answer iv).
--
-- Thread participants are matched through the PLATFORM enrolment: every
-- thread_enrolment carries one (thread_enrolment.enrolment_id), on the
-- thread's program (thread_thread.program_id, unique). Every join below has an
-- index already: enrolment (person_id) and unique (program_id, person_id),
-- thread_thread program_id unique, thread_organiser user_id unique,
-- thread_thread_organiser (organiser_id), team_member (user_id),
-- meet_booking (meeting_type_id).
--
-- Same signature, so `create or replace` keeps the owner and the grants that
-- 20260914171000 set (born closed: service_role + authenticated only).
-- ============================================================================

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
    -- Teammates (staff seeing staff).
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
    -- A thread you organise.
    when exists (
      select 1
        from public.thread_organiser o
        join public.thread_thread t on t.organiser_id = o.id
        join public.enrolment e     on e.program_id   = t.program_id
       where o.user_id   = (select user_id from me)
         and e.person_id = p_person_id
    ) then true
    -- A thread you host or facilitate.
    when exists (
      select 1
        from public.thread_organiser o
        join public.thread_thread_organiser r on r.organiser_id = o.id
        join public.thread_thread t           on t.id           = r.thread_id
        join public.enrolment e               on e.program_id   = t.program_id
       where o.user_id   = (select user_id from me)
         and e.person_id = p_person_id
    ) then true
    -- A thread that belongs to your team.
    when exists (
      select 1
        from public.team_member tm
        join public.thread_thread t on t.team_id    = tm.team_id
        join public.enrolment e     on e.program_id = t.program_id
       where tm.user_id   = (select user_id from me)
         and tm.status    = 'active'
         and e.person_id  = p_person_id
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
    -- Meet: a booking you host.
    when exists (
      select 1
        from public.meet_booking b
        join public.meet_host h on h.id = b.host_id
       where b.invitee_person_id = p_person_id
         and h.user_id           = (select user_id from me)
    ) then true
    -- Meet: a booking of a type you are assigned to, or that your team owns.
    when exists (
      select 1
        from public.meet_booking b
        join public.meet_meeting_type mt on mt.id = b.meeting_type_id
       where b.invitee_person_id = p_person_id
         and (
           exists (
             select 1 from public.meet_meeting_type_assignee a
              where a.meeting_type_id = mt.id
                and a.user_id         = (select user_id from me)
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
