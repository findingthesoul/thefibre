-- A thread can be open and live, and still take no sign-ups from its page.
--
-- Sjoerd, 2026-09-23: *"can you also 'close' enrolment in the thread? In the
-- sense that people can enrol via membership (auto) but on the landing page
-- is no enrolment form?"*
--
-- The case is a thread that fills from somewhere else. A membership tier
-- grants it, so members are enrolled automatically; the public page is there
-- to say what the thread IS — dates, intention, who is running it — and an
-- enrolment form on it would only collect people the organiser has to turn
-- away.
--
-- WHY THIS IS NOT program.status
-- ---------------------------------------------------------------------------
-- `POST /public/enrol` already refuses unless the program is `active`, so
-- today the only way to stop public sign-ups is to un-publish the thread —
-- which also hides it from the listing and makes the page 404 for everyone
-- who is not a workspace member. That closes the door by demolishing the
-- building. This closes the door.
--
-- WHY IT IS NOT A NEW PUBLIC FIELD EITHER
-- ---------------------------------------------------------------------------
-- The public payload has carried `enrolment_open` since the public API
-- shipped, and every consumer already honours it: the thread page, both
-- embeds and the grid hide the form when it is false. It was simply derived
-- from one thing — `program.status === 'active'` — with no way to say no.
-- This column gives that field an input. The published field keeps its name,
-- its type and its meaning, so the contract is unchanged (hard rule 8).
--
-- WHAT STAYS OPEN, which is the whole point:
--   * membership grants — lib/thread-access.ts writes `enrolment` and
--     `thread_enrolment` directly, and never goes near /public/enrol;
--   * the organiser adding somebody by hand;
--   * anyone already enrolled, who keeps their place and their emails.
--
-- Default TRUE: every thread that exists today takes enrolments from its
-- page, and a migration that silently closed them would be a migration that
-- lost somebody a cohort.

alter table public.thread_thread
  add column if not exists public_enrolment_open boolean not null default true;

comment on column public.thread_thread.public_enrolment_open is
  'False = the public page shows no enrolment form and /public/enrol refuses. Membership grants and manual adds are unaffected. See 20260923221945.';
