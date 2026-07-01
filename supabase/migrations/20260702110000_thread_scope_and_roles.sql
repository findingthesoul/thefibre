-- Thread scope + roles (Sjoerd 2026-07-02):
-- 1. A thread can be owned by a platform team (in-family apps use platform
--    tables natively) and/or attributed to an organisation (the public face
--    of the thread — e.g. EBBF's conference).
alter table public.thread_thread
  add column team_id uuid references public.team(id) on delete set null,
  add column organisation_id uuid references public.organisation(id) on delete set null;
create index thread_thread_team_idx on public.thread_thread (team_id)
  where team_id is not null;

-- 2. Per-thread member roles become host | facilitator (v3 naming).
--    'co_organiser' was never used in the UI; rename before re-adding check.
alter table public.thread_thread_organiser
  drop constraint if exists thread_thread_organiser_role_check;
update public.thread_thread_organiser set role = 'host' where role = 'co_organiser';
alter table public.thread_thread_organiser
  alter column role set default 'host';
alter table public.thread_thread_organiser
  add constraint thread_thread_organiser_role_check
  check (role in ('host', 'facilitator'));
