-- Adds the One-off and Meeting-poll event types to Fibre Meet.
--
-- ONE-OFF
--   A meeting type that represents a single fixed date+time, not a recurring
--   booking link. The host picks the exact start/end at MT-creation time;
--   invitees just confirm attendance. Capacity (from v0.11.1) is reused so a
--   one-off can be a 1-attendee interview OR a small group event.
--
-- MEETING POLL
--   The host proposes 2-5 candidate slots. Invitees vote which ones they can
--   attend (multi-select, one row per vote). Later the host (manually, in v1)
--   picks the winning slot — at that point the poll converts into a normal
--   confirmed booking and remaining votes become history.

-- ---------- One-off: fixed slot on the meeting type ------------------------

alter table public.meet_meeting_type
  add column if not exists fixed_starts_at timestamptz,
  add column if not exists fixed_ends_at   timestamptz,
  add constraint meet_meeting_type_fixed_window_chk
    check (
      (fixed_starts_at is null and fixed_ends_at is null)
      or (fixed_starts_at is not null and fixed_ends_at is not null
          and fixed_ends_at > fixed_starts_at)
    );

comment on column public.meet_meeting_type.fixed_starts_at is
  'Fixed start (UTC) for event_type=one_off. NULL for every other event type.';
comment on column public.meet_meeting_type.fixed_ends_at is
  'Fixed end (UTC) for event_type=one_off. Must be > fixed_starts_at.';

-- ---------- Meeting poll: candidate slots + invitee votes ------------------

create table if not exists public.meet_poll_slot (
  meeting_type_id uuid not null references public.meet_meeting_type(id) on delete cascade,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  primary key (meeting_type_id, starts_at),
  constraint meet_poll_slot_window_chk check (ends_at > starts_at)
);

comment on table public.meet_poll_slot is
  'Host-proposed candidate slots for event_type=poll meeting types.';

create table if not exists public.meet_poll_vote (
  id              uuid primary key default gen_random_uuid(),
  meeting_type_id uuid not null references public.meet_meeting_type(id) on delete cascade,
  voter_email     text not null,
  voter_name      text not null,
  slot_starts_at  timestamptz not null,
  created_at      timestamptz not null default now(),
  -- Each (voter, slot) pair is at most one vote. Voters can vote for many slots
  -- (one row per slot they can attend) but cannot duplicate a vote.
  unique (meeting_type_id, voter_email, slot_starts_at)
);

comment on table public.meet_poll_vote is
  'One row per (voter, slot) tick on a meeting poll. A voter can have many rows.';

create index if not exists meet_poll_vote_mt_idx
  on public.meet_poll_vote (meeting_type_id);

-- ---------- RLS ------------------------------------------------------------

alter table public.meet_poll_slot enable row level security;
alter table public.meet_poll_vote enable row level security;

-- Hosts (and team members of the MT) can read+write slots; invitees can read
-- via the adminClient on the public endpoint. Mirror the meet_meeting_type
-- policy: a row is visible/mutable if you can see its parent MT.

create policy meet_poll_slot_select on public.meet_poll_slot
  for select using (
    exists (
      select 1 from public.meet_meeting_type mt
      where mt.id = meet_poll_slot.meeting_type_id
    )
  );

create policy meet_poll_slot_write on public.meet_poll_slot
  for all using (
    exists (
      select 1 from public.meet_meeting_type mt
      where mt.id = meet_poll_slot.meeting_type_id
    )
  ) with check (
    exists (
      select 1 from public.meet_meeting_type mt
      where mt.id = meet_poll_slot.meeting_type_id
    )
  );

-- Votes: only the MT host (or team member) can SELECT through the user client.
-- INSERTs happen through the adminClient on the public POST endpoint, which
-- bypasses RLS deliberately. Authenticated rows still respect the policy below.

create policy meet_poll_vote_select on public.meet_poll_vote
  for select using (
    exists (
      select 1 from public.meet_meeting_type mt
      where mt.id = meet_poll_vote.meeting_type_id
    )
  );

create policy meet_poll_vote_delete on public.meet_poll_vote
  for delete using (
    exists (
      select 1 from public.meet_meeting_type mt
      where mt.id = meet_poll_vote.meeting_type_id
    )
  );
