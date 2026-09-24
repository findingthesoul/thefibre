-- thread_calendar_changes
--
-- What has changed about a session since the people holding it were last
-- told, and how many times each session has been re-announced.
--
-- ---------------------------------------------------------------------------
-- WHY A QUEUE AND NOT A SEND
-- ---------------------------------------------------------------------------
-- Sjoerd, 2026-09-24: *"when someone moves an event for which people have
-- registered and RSVP-ed, changing the date is with an extra warning… This
-- should not be a light thing."* And: *"if an organiser moves five sessions in
-- one sitting, that's one email, not five."*
--
-- Both point the same way: editing and announcing are different acts, and the
-- system should not conflate them. An organiser rearranging a programme on a
-- Tuesday afternoon is thinking, not broadcasting. So a change lands here,
-- unsent, and the thread grows a bar saying who has not been told. The
-- organiser reviews and presses once.
--
-- ---------------------------------------------------------------------------
-- WHAT COLLAPSES
-- ---------------------------------------------------------------------------
-- Rows are per (engagement, unsent), not per edit. Moving a session three
-- times before pressing send is ONE change — from where it originally was to
-- where it now is — because that is the only thing a participant could act
-- on. `was` is therefore written once, on the first unsent change, and never
-- overwritten; `now_state` is rewritten on every subsequent edit.
--
-- A session ADDED and then CANCELLED while both are still unsent deletes the
-- row and sends nothing. Nobody was ever told it existed, so there is nothing
-- to correct.
--
-- ---------------------------------------------------------------------------
-- WHAT DOES NOT PRODUCE A CHANGE
-- ---------------------------------------------------------------------------
-- A session whose invitation has never gone out (`calendar_sent_at` null) is
-- not in anybody's calendar, so moving it is not an update — it is still just
-- a draft being drafted. Only the FIRST send makes a session real, and from
-- then on it can be moved or cancelled.
--
-- Nor does a typo. Sjoerd agreed the trigger set explicitly: date, time,
-- place, or existence. Editing a description mails nobody.
-- ---------------------------------------------------------------------------

-- How many times this session has been announced. iMIP requires a SEQUENCE
-- that only ever increases: a calendar ignores an update numbered at or below
-- the one it already holds, which is exactly how a stale retry is made safe.
alter table public.thread_engagement
  add column if not exists calendar_sequence integer not null default 0,
  add column if not exists calendar_sent_at timestamptz;

comment on column public.thread_engagement.calendar_sequence is
  'iMIP SEQUENCE. Incremented only when an invitation or update is actually sent, never on edit.';
comment on column public.thread_engagement.calendar_sent_at is
  'When an invitation for this session last went out. Null means nobody holds it, so it cannot be "moved" — only added.';

create table if not exists public.thread_calendar_change (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspace(id) on delete cascade,
  thread_id      uuid not null references public.thread_thread(id) on delete cascade,
  -- Nulled when the engagement is deleted outright: the row must outlive it,
  -- because a cancellation is precisely the case where the thing is gone and
  -- people still need telling.
  engagement_id  uuid references public.thread_engagement(id) on delete set null,
  kind           text not null check (kind in ('added', 'moved', 'cancelled')),
  -- Snapshots, not joins. The title is copied because a cancelled session's
  -- row may be deleted before anyone presses send, and "a session was
  -- cancelled" without its name is not a message anyone can act on.
  title          text not null,
  was            jsonb,
  now_state      jsonb,
  created_at     timestamptz not null default now(),
  created_by     uuid references public."user"(id) on delete set null,
  sent_at        timestamptz
);

-- The queue lookup: everything still owed on one thread.
create index if not exists thread_calendar_change_pending_idx
  on public.thread_calendar_change (thread_id)
  where sent_at is null;

-- One unsent row per session, which is what makes repeated edits collapse
-- rather than pile up.
create unique index if not exists thread_calendar_change_one_pending_idx
  on public.thread_calendar_change (engagement_id)
  where sent_at is null and engagement_id is not null;

alter table public.thread_calendar_change enable row level security;

create policy thread_calendar_change_scope on public.thread_calendar_change
  for all to authenticated
  using (workspace_id = public.current_workspace_id()
         and public.has_app_membership('the-thread'))
  with check (workspace_id = public.current_workspace_id()
              and public.has_app_membership('the-thread'));
