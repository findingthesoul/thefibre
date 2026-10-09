-- Scheduled messages a workspace is over its allowance to send.
--
-- docs/free-plan-limits-and-meet-tiers.md, option 2 ("hold and ask"), chosen
-- because it is the only one of the three where our pricing decision does not
-- damage the customer's event: past the cap the mail QUEUES, the admins are
-- told how many are waiting, and releasing is one act.
--
-- ---------------------------------------------------------------------------
-- Why this is a TABLE and not simply "don't send yet"
-- ---------------------------------------------------------------------------
-- The obvious implementation is to skip the send and let the scheduler pick
-- it up again next tick. That silently loses the mail. `SCHEDULER_LOOKBACK_MS`
-- is 72 hours: a message more than three days past due is never sent, by
-- design ("visible on the timeline, never emailed late"). So a workspace that
-- hits its cap on a Friday and upgrades on Tuesday would find the queue it was
-- promised had quietly evaporated — and the promise that nothing was lost is
-- the entire reason this option was chosen over a hard stop.
--
-- A row here is therefore the record that the message CAME DUE and was held.
-- Release reads it and sends, whatever the lookback says, because the lookback
-- exists to stop a restarting scheduler blasting ancient mail — not to expire
-- something we deliberately parked.
--
-- ---------------------------------------------------------------------------
-- It mirrors thread_message_send on purpose
-- ---------------------------------------------------------------------------
-- Same key: one row per (engagement, person). A message is either sent or
-- held, never both, and the unique index is what makes a retry or an
-- overlapping scheduler run safe here exactly as it is there.
create table if not exists public.thread_message_hold (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace (id) on delete cascade,
  engagement_id uuid not null references public.thread_engagement (id) on delete cascade,
  person_id uuid not null references public.person (id) on delete cascade,
  email text not null,
  -- When it came due, NOT when it was held. Release sends in the order the
  -- organiser scheduled, so a held sequence arrives in the order it was
  -- written rather than in the order a cron happened to notice it.
  due_at timestamptz not null,
  held_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists thread_message_hold_once
  on public.thread_message_hold (engagement_id, person_id);

-- Release walks one workspace at a time.
create index if not exists thread_message_hold_by_workspace
  on public.thread_message_hold (workspace_id, due_at);

alter table public.thread_message_hold enable row level security;

-- Service-role only, deliberately. Nothing in a browser reads or writes this:
-- the count a workspace sees comes from the API, and releasing is an API act
-- with a plan check in front of it. A policy letting a member read it would
-- expose one person's email address on another person's held message for no
-- benefit.
comment on table public.thread_message_hold is
  'Scheduled thread messages parked because the workspace is past its monthly email allowance (2026-10-09). One row per (engagement, person), the same key as thread_message_send — a message is either sent or held, never both. Rows are deleted as they are released and sent. Service-role only; no RLS policy grants access to anybody else.';
