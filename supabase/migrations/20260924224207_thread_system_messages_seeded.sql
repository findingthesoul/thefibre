-- A system message you delete has to stay deleted.
--
-- Sjoerd, 2026-09-25, after duplicating a thread into "fellowship year
-- agenda": *"It auto copies the enrolment message. I CAN'T DELETE ONE."*
--
-- Two faults met, and the second is the one that made it feel unfixable.
--
-- 1. `POST /threads/:id/duplicate` copies engagements with an explicit column
--    list, and that list never included `system_role`. So the copy of the
--    enrolment message arrived as an ORDINARY message. Opening the new
--    thread then ran `ensureSystemEngagements`, which looked for a row
--    carrying `enrolment_confirmed`, found none, and seeded a second one.
--    Two identical "You're enrolled" messages, both at position -2, and
--    nothing on screen distinguishing them.
--
-- 2. `ensureSystemEngagements` runs on EVERY editor load and decides purely
--    on whether the row exists. So deleting the real system message
--    re-created it moments later. The comment above that function has always
--    said "Seeded, not required. Delete one and the send falls back to the
--    platform's compiled email — nobody loses a ticket by tidying up." That
--    was not true and had never been true: the message was undeletable, and
--    since the two copies looked the same, a 50/50 guess decided whether
--    deleting appeared to work at all.
--
-- This column is the difference between "is it here?" and "did we already
-- give it to you?". Seeding records the role; seeding skips a role already
-- recorded. Delete it and it is gone, which is what the comment promised.
--
-- Per-role rather than one boolean, because the second message
-- (`enrolment_received`) only applies while a thread requires approval —
-- turning approval on later must still seed it once, and a single flag would
-- either block that or re-open the hole for both.
--
-- Not backfilled. An existing thread has not had a system message deleted
-- through this mechanism, so an empty array is the truthful starting state:
-- it seeds once more where the row is genuinely absent, and records it.

alter table public.thread_thread
  add column if not exists system_messages_seeded text[] not null default '{}';

comment on column public.thread_thread.system_messages_seeded is
  'system_role values already seeded for this thread, so a deleted system message is not re-created on the next editor load. See ensureSystemEngagements. Added 20260924224207.';
