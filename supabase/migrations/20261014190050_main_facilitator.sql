-- main_facilitator
--
-- Sjoerd, 2026-10-14: "I made the thread. But someone else will facilitate.
-- Problem is that the Virtual room should be from the main facilitator."
-- A session's "personal room" resolved from whoever SAVED it, so a thread he
-- built and someone else runs met in his room. Additive; nothing reads these
-- until the code that writes them ships.

-- WHO RUNS THE THREAD: one of its hosts or facilitators (a
-- thread_thread_organiser row). Null = the organiser, as today. Removing that
-- person from the thread clears it (on delete set null), and sessions fall
-- back to the organiser's room — a change the code queues and says.
alter table public.thread_thread
  add column if not exists main_facilitator_id uuid
    references public.thread_thread_organiser(id) on delete set null;

-- WHO IS ON EACH SESSION, as an EXCLUSION list of thread_thread_organiser
-- ids: empty = everybody, so a person added to the thread later is on every
-- session automatically ("by default all are there"). An unticked person is
-- left out of that session's calendar invitation and its public "hosted by".
alter table public.thread_engagement
  add column if not exists excluded_people uuid[] not null default '{}';

-- WHOSE ACCOUNT made a session's Google Meet or Zoom link, so later edits use
-- the same account, and that person can be shown it was made on theirs.
alter table public.thread_engagement
  add column if not exists meeting_account_user_id uuid
    references public."user"(id) on delete set null;

-- THE PERSON'S OWN YES to meeting links being created on their connected
-- account by an organiser. Default no: using someone's OAuth credential needs
-- that person's consent, not the organiser's. Set only by them, in their own
-- Settings → Connections. (A personal room is a link they shared, and needs
-- none.)
alter table public.user_connection
  add column if not exists allow_organiser_meetings boolean not null default false;

-- WHY a queued calendar change exists, when the organiser did not make it:
-- "room changed: <facilitator> updated their personal room". Shown on the
-- change line in the SEND tray, so a pending send nobody remembers making
-- explains itself.
alter table public.thread_calendar_change
  add column if not exists reason text;

-- WHOSE ROOM EACH SESSION MEETS IN — the RULE, as opposed to
-- meeting_account_user_id, which records who MADE a link (a fact about the
-- past). Null = follows the thread's main facilitator (the organiser when
-- none is named); set = pinned to one of the thread's hosts or facilitators.
-- Removing that person un-pins the session (it follows the main facilitator
-- again), propagated and queued by the code.
alter table public.thread_engagement
  add column if not exists room_owner_id uuid
    references public.thread_thread_organiser(id) on delete set null;

-- WHICH HOST ADDRESSES HOLD THE CURRENT INVITATION, written at SEND. The
-- next send diffs the hosts ticked now against this: added hosts get the
-- invitation, removed ones a CANCEL of the same event.
alter table public.thread_engagement
  add column if not exists invited_hosts text[] not null default '{}';

-- A change to WHO HOSTS a session that has already gone out: only the hosts
-- added or removed are written to, never the participants.
alter table public.thread_calendar_change
  drop constraint if exists thread_calendar_change_kind_check;
alter table public.thread_calendar_change
  add constraint thread_calendar_change_kind_check
    check (kind in ('added', 'moved', 'cancelled', 'people'));
