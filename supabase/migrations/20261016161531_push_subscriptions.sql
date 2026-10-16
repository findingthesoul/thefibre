-- push_subscriptions
--
-- Web push for my.thread (docs/web-push-plan.md; Sjoerd's answers 2026-10-16,
-- all as recommended): the bell's rows arrive on a participant's phone or
-- desktop when they asked for that ON THAT DEVICE. No new events — push carries
-- exactly what member_notification already holds, by the same rules.
--
-- Read and written by the API only, with the service role: RLS on, no
-- policies, like member_notification and user_connection. A participant
-- reaches their own rows through /me/portal/push/*, scoped by verified email.

-- One row per device that opted in.
create table public.push_subscription (
  id           uuid primary key default gen_random_uuid(),
  -- The participant's verified email: the key every /me/portal route is
  -- scoped by, and the one identity_profile uses. NOT person_id — person is
  -- per workspace, and a phone belongs to the human, not to one community.
  -- Stored lower-case, and the database refuses anything else: every lookup
  -- matches by email, and "Anna@x.org" vs "anna@x.org" would be two people.
  email        text not null check (email = lower(email)),
  -- Where the push service takes deliveries for this device. Allow-listed by
  -- host in the API before it is stored (an endpoint is an address the server
  -- POSTs to). Unique: re-subscribing the same device updates its row.
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  -- "iPhone · Safari", for the device list on You → Notifications. Derived
  -- from the user agent at subscribe time; the raw user agent is never kept.
  device_label text,
  created_at   timestamptz not null default now(),
  last_ok_at   timestamptz,
  -- Consecutive failures that were not a 404/410. Reset by a success.
  fail_count   integer not null default 0,
  first_fail_at timestamptz
);

-- HARD delete is deliberate, and the one exception to "soft delete only" this
-- table makes (Sjoerd, 2026-10-16, §10 question 3: yes). A dead endpoint is
-- not a record of anything; keeping it would only mean holding a device
-- identifier nobody can use. Rows go on a 404/410 from the push service, after
-- 5 failures over at least 3 days, on sign-out, and on erasure.

create index push_subscription_email_idx on public.push_subscription (email);

alter table public.push_subscription enable row level security;
-- No policies on purpose: reached only through the API.

-- Which bell rows still owe a push. Default 'none' so every row that exists
-- today stays unpushed: switching push on never replays the backlog. A new row
-- is written 'pending' only when its person has a subscription at insert time.
alter table public.member_notification
  add column push_state text not null default 'none'
    check (push_state in ('pending', 'sent', 'skipped', 'none')),
  add column pushed_at timestamptz;

create index member_notification_push_pending_idx
  on public.member_notification (person_id)
  where push_state = 'pending';
