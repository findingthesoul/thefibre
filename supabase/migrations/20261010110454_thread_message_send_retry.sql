-- A scheduled message whose transport FAILED must not count as sent.
--
-- Found on 2026-10-10, watching a real send fail on staging for the first
-- time. The dedup is insert-first: the `thread_message_send` row is written
-- BEFORE the email is attempted, so when Resend refused the address the row
-- stayed, and the scheduler considered that message done for ever. Nobody is
-- told, the participant never receives it, and a log line is the only trace.
--
-- That has been true of every scheduled and triggered send since the table
-- was created, and it is live on production: a Resend outage, a bounced
-- domain or an expired key silently swallows people's mail.
--
-- ---------------------------------------------------------------------------
-- Why not simply delete the row on failure
-- ---------------------------------------------------------------------------
-- Because then a permanently bad address retries every five minutes for the
-- whole 72-hour lookback — some 800 attempts, each one a rejected API call —
-- and still ends in silence. The row has to survive and say what happened.
--
-- So the row gains a verdict. `failed_at` null and the row present means
-- SENT, exactly as before. `failed_at` set means attempted and refused, and
-- the next tick may try again until `attempts` reaches its limit, after which
-- it stops and the row is the visible record of a message that never got
-- through.
--
-- Existing rows get `failed_at = null`, which reads as "sent" — true of every
-- one of them that actually went, and unknowable for any that did not. The
-- backfill cannot invent history it does not have; from here forward the
-- distinction is recorded.
alter table public.thread_message_send
  add column if not exists failed_at timestamptz,
  add column if not exists attempts smallint not null default 1;

-- The retry walk, and anything that wants to show "these never got through".
create index if not exists thread_message_send_failed
  on public.thread_message_send (engagement_id)
  where failed_at is not null;

comment on column public.thread_message_send.failed_at is
  'NULL means this message was sent. Non-null means the transport refused it, and the row exists to stop the send being retried for ever AND to leave a trace — before 2026-10-10 a failed send was indistinguishable from a successful one, so mail was lost silently.';

comment on column public.thread_message_send.attempts is
  'How many times the transport has been asked to deliver this. Stops a permanently bad address from being retried every five minutes for the whole 72-hour lookback.';
