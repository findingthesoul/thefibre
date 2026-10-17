-- thread_calendar_held
--
-- Who holds which session in their calendar (calendar gaps, slice 1; Sjoerd,
-- 2026-10-17: "amazing. Go." — the 6-week window, one mail per session,
-- thread-end cancels, existing members included). Nothing reads it yet.
--
-- WHY. Until now an invitation left with no record per person: the
-- organiser's SEND mails whoever holds a live place at that moment and marks
-- the CHANGE sent. To invite someone to a session they do not hold yet, and
-- to send a CANCEL only to those who got the REQUEST, we need the other
-- half: per address, per session, the last thing we sent and its sequence.
--
-- One row per (session, address), updated in place: `method` is the last
-- one sent — REQUEST means it is in their calendar, CANCEL that we took it
-- out. Written by every send path from now on (the window, the organiser's
-- SEND, a thread ending). For the LAUNCH, the people who already received an
-- organiser SEND before this table existed are derived from the send history
-- (a change sent while their place was live), so nobody gets a session twice.
--
-- What the app justifies (Thread): the address an invitation went to and
-- which session — exactly what a CANCEL must reach. The address is the
-- enrolment's own, lowercased. Service role only: it is a delivery record,
-- read by the API, never by a browser.

create table public.thread_calendar_held (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspace(id) on delete cascade,
  thread_id      uuid not null references public.thread_thread(id) on delete cascade,
  -- The session. No FK: a deleted session's CANCEL is exactly what this
  -- record is for, and the row must outlive the engagement it names.
  engagement_id  uuid not null,
  email          citext not null check (length(email) between 3 and 320),
  method         text not null check (method in ('REQUEST', 'CANCEL')),
  sequence       integer not null check (sequence >= 0),
  -- Which path sent it: the rolling window, the organiser's SEND, or a whole
  -- thread ending.
  source         text not null check (source in ('window', 'send', 'thread_end')),
  sent_at        timestamptz not null default now(),
  unique (engagement_id, email)
);

create index thread_calendar_held_thread_idx on public.thread_calendar_held (thread_id);

alter table public.thread_calendar_held enable row level security;
-- No policy at all: service role only.

-- The launch switch is platform_setting `calendar_window`, the calendar
-- nudge's pattern: ABSENT (or anything but 'on') is OFF, so no row is
-- written here — production sends window invitations only once Sjoerd has
-- seen the dry-run's counts and sets it to 'on'.
