-- Fibre Meet — Soul Suite parity round (docs/meet-vs-suite-parity.md items 1-4).
--
-- Four things Suite v1 had that Meet did not:
--   1. Zoom conferencing (per-user OAuth). The credential is a user-level
--      connection, so it lands in the connections SPoT (user_connection),
--      NEVER on the workspace-readable meet_host — same reasoning as
--      google_refresh_token in v0.13.107.
--   2. Reschedule. A rescheduled booking keeps its id (the purchase ledger
--      row points at it by item_ref), so nothing here changes shape; what we
--      do need is a handle on the Zoom meeting to PATCH.
--   3. Round-robin fairness, configurable per meeting type. Meet's rule was
--      hardcoded least-loaded; Suite let each team choose. Meet's assignees
--      live on the meeting type, so the rule lives there too.
--   4. Per-team working-hours override — "when I schedule for THIS team, I'm
--      available Tue-Thu". Suite kept it on ProjectMember; Meet's teams are
--      platform-owned (team/team_member), so the override is app-owned data
--      keyed by (team, user).

-- ---------------------------------------------------------------------------
-- 1. Zoom credentials (connections SPoT)
-- ---------------------------------------------------------------------------
alter table public.user_connection
  add column if not exists zoom_refresh_token text,
  add column if not exists zoom_account_email text;

comment on column public.user_connection.zoom_refresh_token is
  'Zoom user-managed OAuth refresh token. Zoom ROTATES this on every use — the
   refresher must persist the new one or the next call 401s. Service-role only,
   like google_refresh_token; never exposed through PostgREST.';
comment on column public.user_connection.zoom_account_email is
  'The Zoom account this connection belongs to. Shown in Settings → Integrations
   so a user can tell which of several Zoom accounts is wired up.';

-- ---------------------------------------------------------------------------
-- 2. The Zoom meeting a booking owns
-- ---------------------------------------------------------------------------
alter table public.meet_booking
  add column if not exists zoom_meeting_id text;

comment on column public.meet_booking.zoom_meeting_id is
  'Zoom meeting id created for this booking (conferencing_provider=zoom).
   Reschedule PATCHes it, cancel DELETEs it. NULL for every other provider.';

-- ---------------------------------------------------------------------------
-- 3. Round-robin fairness rule, per meeting type
-- ---------------------------------------------------------------------------
alter table public.meet_meeting_type
  add column if not exists round_robin_fairness text not null default 'least_loaded';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'meet_meeting_type_rr_fairness_chk'
  ) then
    alter table public.meet_meeting_type
      add constraint meet_meeting_type_rr_fairness_chk
      check (round_robin_fairness in (
        'least_loaded','least_recently_assigned','strict_rotation','random'
      ));
  end if;
end $$;

comment on column public.meet_meeting_type.round_robin_fairness is
  'How event_type=round_robin picks among the assignees who are free at the
   requested slot. least_loaded (the historic hardcoded rule, kept as default)
   counts upcoming confirmed bookings; least_recently_assigned takes whoever
   has waited longest (derived from the bookings themselves — no counter to
   drift); strict_rotation walks the assignee order; random picks uniformly.
   Ignored by every other event type.';

-- ---------------------------------------------------------------------------
-- 4. Per-team working-hours override
-- ---------------------------------------------------------------------------
create table if not exists public.meet_team_member_hours (
  team_id       uuid not null references public.team(id) on delete cascade,
  user_id       uuid not null references public."user"(id) on delete cascade,
  working_hours jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (team_id, user_id)
);

comment on table public.meet_team_member_hours is
  'Optional per-team override of a host''s weekly availability. Resolution order
   in the slot engine: meeting_type.working_hours_override → this row (team-owned
   meeting types only) → meet_host.working_hours. Same JSON shape as
   meet_host.working_hours: { mon: [{start,end}], … } in the host''s timezone.';

create index if not exists meet_team_member_hours_user_idx
  on public.meet_team_member_hours (user_id);

alter table public.meet_team_member_hours enable row level security;

-- Read: anyone with fibre-meet who can see the team (it's in their workspace).
create policy meet_team_member_hours_read on public.meet_team_member_hours
  for select to authenticated
  using (
    public.has_app_membership('fibre-meet')
    and exists (
      select 1 from public.team t
      where t.id = meet_team_member_hours.team_id
        and t.workspace_id = public.current_workspace_id()
    )
  );

-- Write: the team lead sets anyone's hours; a member sets their own.
create policy meet_team_member_hours_write on public.meet_team_member_hours
  for all to authenticated
  using (
    public.has_app_membership('fibre-meet')
    and (
      public.meet_is_team_lead(meet_team_member_hours.team_id)
      or meet_team_member_hours.user_id = public.current_user_id()
    )
  )
  with check (
    public.has_app_membership('fibre-meet')
    and (
      public.meet_is_team_lead(meet_team_member_hours.team_id)
      or meet_team_member_hours.user_id = public.current_user_id()
    )
  );
