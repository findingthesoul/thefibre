-- Participant visibility (Sjoerd 2026-07-02): a thread can share who's
-- enrolled publicly and/or with fellow participants. Names only ever show
-- for people who ticked the cohort_directory consent at enrolment
-- (brief §9 — opt-in, never default).
alter table public.thread_thread
  add column share_participants_public boolean not null default false,
  add column share_participants_participants boolean not null default false;
