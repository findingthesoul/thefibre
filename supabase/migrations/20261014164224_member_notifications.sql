-- member_notifications
--
-- Telling a member when something new appears on a team calendar they
-- follow, or a session they can see moves or is cancelled — in my.thread, and
-- in ONE email per person per workspace after a quiet window (item 3,
-- 2026-10-14; design approved by the coordinating session on Sjoerd's ask:
-- "if a new event is added to a certain agenda, a follower of that agenda gets
-- a message, email and notification").
--
-- Session changes are NOT detected at the edit. They ride the organiser's
-- existing SEND (thread_calendar_change, "editing is not announcing"), so
-- nothing here watches thread_engagement.
--
-- All three tables are read and written by the API only, with the service
-- role: RLS on, no policies, like user_connection. A member reaches their own
-- rows through /me/portal/*, which resolves them by verified email.

-- One row per thing a person is told about. TYPE + SUBJECT, never a body: the
-- subject is a title the person could already see, the date is the session's.
create table public.member_notification (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  person_id    uuid not null references public.person(id) on delete cascade,
  kind         text not null check (kind in ('new_thread', 'session_moved', 'session_cancelled')),
  thread_id    uuid references public.thread_thread(id) on delete set null,
  subject      text not null,
  -- The session's (new) start for a move, its start for a cancellation, the
  -- thread's start date for a new thread. Display only.
  starts_at    timestamptz,
  read_at      timestamptz,
  -- 'pending' waits for the digest; 'sent' went out in one; 'skipped' was not
  -- emailed (opted out, workspace switch off, thread gone); 'none' was never
  -- meant for email (an enrolled participant already got the calendar update
  -- from the organiser's SEND — a digest on top would be a second email about
  -- one change).
  email_state  text not null default 'pending'
                 check (email_state in ('pending', 'sent', 'skipped', 'none')),
  emailed_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- "New" fires once per person and thread, EVER: a thread that goes hidden and
-- visible again does not announce itself twice.
create unique index member_notification_new_once
  on public.member_notification (person_id, thread_id)
  where kind = 'new_thread';
create index member_notification_person_idx
  on public.member_notification (person_id, created_at desc);
create index member_notification_pending_idx
  on public.member_notification (person_id)
  where email_state = 'pending';

alter table public.member_notification enable row level security;
-- No policies on purpose: reached only through the API.

-- The per-person email switch. Keyed on PERSON, which is already one
-- workspace's — so somebody who bought a single thread and holds no
-- membership has a pref too, and the unsubscribe link works for them.
create table public.member_notification_pref (
  person_id         uuid primary key references public.person(id) on delete cascade,
  workspace_id      uuid not null references public.workspace(id) on delete cascade,
  email_off         boolean not null default false,
  -- The one-click link in every email. Minted by the API (crypto random),
  -- never derived from an id.
  unsubscribe_token text not null unique,
  updated_at        timestamptz not null default now()
);

alter table public.member_notification_pref enable row level security;
-- No policies on purpose: reached only through the API.

-- Which threads have already been seen on a calendar, so "new" means new.
-- The FIRST pass after this ships records everything already visible with
-- announced = false and tells nobody: the first deploy to production must
-- email nobody about threads that have been there all along.
create table public.thread_calendar_seen (
  thread_id     uuid primary key references public.thread_thread(id) on delete cascade,
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  announced     boolean not null
);

alter table public.thread_calendar_seen enable row level security;
-- No policies on purpose: reached only through the API.

-- The workspace switch, in Members → Settings: "Tell members about new and
-- changed threads". Default ON; off lets an admin restructure a calendar
-- without announcing every step. While off, threads are still marked seen, so
-- switching back on does not flood anybody with the restructure.
alter table public.membership_settings
  add column if not exists notify_members boolean not null default true;
