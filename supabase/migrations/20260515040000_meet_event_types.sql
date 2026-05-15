-- Fibre Meet — Round-robin + Collective event types (Step 7).
--
-- Adds an `event_type` to meet_meeting_type and a `meet_meeting_type_assignee`
-- table that lists the team members who can run (or must attend) a given
-- team-owned meeting type. Phase 1 covers:
--   one_on_one  — single host (host_id on the booking). The default.
--   round_robin — multiple eligible hosts; booking is routed to one of them
--                 at create time (least-loaded heuristic in the API).
--   collective  — multiple required hosts; all attend the same event. We
--                 keep the canonical event on the primary assignee's
--                 calendar and add the others as attendees.
--   group       — reserved for a future change (single host, many invitees).
--
-- Only team-owned meeting types may use round_robin / collective in phase 1.
-- Personal meeting types stay one_on_one.

alter table public.meet_meeting_type
  add column event_type text not null default 'one_on_one'
    check (event_type in ('one_on_one','round_robin','collective','group'));

alter table public.meet_meeting_type
  add constraint meet_meeting_type_team_only_multihost
  check (
    event_type in ('one_on_one','group') or team_id is not null
  );

create index meet_meeting_type_event_type_idx
  on public.meet_meeting_type (event_type)
  where event_type != 'one_on_one';

-- ---------------------------------------------------------------------------
-- meet_meeting_type_assignee — which team members are eligible for a given
-- team-owned meeting type. Exactly one assignee is marked `is_primary` per
-- meeting type; it's the one whose calendar holds the canonical event and
-- whose timezone drives the public-facing slot list.
-- ---------------------------------------------------------------------------
create table public.meet_meeting_type_assignee (
  meeting_type_id uuid not null references public.meet_meeting_type(id) on delete cascade,
  user_id         uuid not null references public."user"(id) on delete cascade,
  is_primary      boolean not null default false,
  created_at      timestamptz not null default now(),
  primary key (meeting_type_id, user_id)
);

-- At most one primary per meeting type.
create unique index meet_meeting_type_assignee_primary_uq
  on public.meet_meeting_type_assignee (meeting_type_id)
  where is_primary;

create index meet_meeting_type_assignee_user_idx
  on public.meet_meeting_type_assignee (user_id);

-- ---------------------------------------------------------------------------
-- RLS — readable when you have fibre-meet in this workspace AND the meeting
-- type's team is in this workspace; writable when you're a lead of that team.
-- We reuse meet_is_team_lead() (security definer) to keep this non-recursive.
-- ---------------------------------------------------------------------------
alter table public.meet_meeting_type_assignee enable row level security;

create policy meet_meeting_type_assignee_read on public.meet_meeting_type_assignee
  for select to authenticated
  using (
    public.has_app_membership('fibre-meet')
    and exists (
      select 1
      from public.meet_meeting_type mt
      join public.meet_team t on t.id = mt.team_id
      where mt.id = meet_meeting_type_assignee.meeting_type_id
        and t.workspace_id = public.current_workspace_id()
    )
  );

create policy meet_meeting_type_assignee_write on public.meet_meeting_type_assignee
  for all to authenticated
  using (
    public.has_app_membership('fibre-meet')
    and exists (
      select 1
      from public.meet_meeting_type mt
      where mt.id = meet_meeting_type_assignee.meeting_type_id
        and mt.team_id is not null
        and public.meet_is_team_lead(mt.team_id)
    )
  )
  with check (
    public.has_app_membership('fibre-meet')
    and exists (
      select 1
      from public.meet_meeting_type mt
      where mt.id = meet_meeting_type_assignee.meeting_type_id
        and mt.team_id is not null
        and public.meet_is_team_lead(mt.team_id)
    )
  );
