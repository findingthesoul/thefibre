-- Releasing a held message keeps the row, and lets go of the address.
--
-- The first version of this table (20261009212925) said rows are DELETED as
-- they are released. That is wrong twice over.
--
-- ---------------------------------------------------------------------------
-- 1. Hard rule 4: soft delete only for personal data
-- ---------------------------------------------------------------------------
-- A hold row carries `person_id` and `email`. Deleting it is a hard delete of
-- personal data, which CLAUDE.md forbids outright. It is also the wrong
-- behaviour on its own terms: "how many did we park for this customer, and
-- did they all go out?" is exactly the question somebody asks after a
-- release, and a deleted queue cannot answer it.
--
-- ---------------------------------------------------------------------------
-- 2. …and minimisation says not to keep the address
-- ---------------------------------------------------------------------------
-- Once released, `thread_message_send` holds the (engagement, person, email)
-- record of the send. Keeping the address here as well is a second copy of
-- somebody's personal datum serving no further purpose, which brief §6 and
-- GDPR 5(1)(c) both argue against.
--
-- So release does both: stamp `released_at`, and null the address. The row
-- survives as the record that this message was held and when it went; the
-- redundant copy of the person's email does not. `person_id` stays, so the
-- row remains attributable if anyone has to audit it.
alter table public.thread_message_hold
  add column if not exists released_at timestamptz;

-- Nullable, so the address can be cleared on release. It is present while a
-- message is waiting, which is the only time anything needs to read it.
alter table public.thread_message_hold
  alter column email drop not null;

-- What is still waiting, which is the common read: the release walk, and the
-- count a workspace is shown.
create index if not exists thread_message_hold_waiting
  on public.thread_message_hold (workspace_id, due_at)
  where released_at is null;

comment on table public.thread_message_hold is
  'Scheduled thread messages parked because the workspace is past its monthly email allowance (2026-10-09). One row per (engagement, person), the same key as thread_message_send — a message is either sent or held, never both. Releasing STAMPS released_at and nulls the email; rows are never deleted (hard rule 4: soft delete only for personal data), and the address is dropped on release because thread_message_send already records it. Service-role only; no RLS policy grants access to anybody else.';

comment on column public.thread_message_hold.released_at is
  'When this message was let go and sent. NULL means it is still waiting. The email column is nulled at the same moment, because thread_message_send carries the address from then on.';
