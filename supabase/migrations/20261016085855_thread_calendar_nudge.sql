-- thread_calendar_nudge — one reminder per thread per batch of unsent changes.
--
-- Calendar changes wait for the organiser's SEND, and Sjoerd wants it to stay
-- that way: "keep send manual with nudge" (2026-10-16). The nudge is an email
-- to the organiser when changes have sat unsent for 24 hours. This table is
-- its claim: the scheduler INSERTs a row before it mails, ON CONFLICT DO
-- NOTHING, and only the tick that got a row back sends — the
-- thread_message_send pattern, so two ticks (or two machines) send one mail.
--
-- THE BATCH IS "SINCE THE LAST SEND". `after_send_at` is the thread's latest
-- thread_calendar_change.sent_at when the reminder went out (epoch when it
-- had never sent). One reminder per value: however long that queue then
-- sits, or however it is edited, it is not reminded again. Pressing SEND
-- moves the value, which is what re-arms it for the next batch.
--
-- Read and written by the API only, with the service role: RLS on, no
-- policies, like thread_message_send.

create table public.thread_calendar_nudge (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  thread_id     uuid not null references public.thread_thread(id) on delete cascade,
  after_send_at timestamptz not null,
  -- How many changes were waiting, and since when — what the email said.
  change_count  integer not null,
  oldest_at     timestamptz not null,
  -- Null between the claim and the send; stays null when the send failed or
  -- was skipped (no organiser address), so the row records that it was tried.
  sent_at       timestamptz,
  skipped       text,
  created_at    timestamptz not null default now(),
  unique (thread_id, after_send_at)
);

alter table public.thread_calendar_nudge enable row level security;
-- No policies on purpose: reached only through the API.
