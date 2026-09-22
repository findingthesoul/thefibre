-- ============================================================================
-- "To do" — one personal list, across the apps
-- (docs/personal-todo-proposal.md, Sjoerd's decisions 2026-09-22).
--
-- The list a person keeps for themselves. Two kinds of row live here:
--
--   * a to-do somebody typed ("ring the accountant") — source_app is null;
--   * the ANSWER to something an app owns (a Flow task, a Thread engagement):
--     source_app + source_ref, no copy of the app's content. The item itself
--     stays in its app and is composed at read time; this row only remembers
--     ticked / snoozed / where you dragged it.
--
-- Why no mirror of app content: a copy goes stale the moment the owning app
-- changes its row, and it would put another app's content in a platform
-- table — the thing the data wall forbids (brief §2). Composition cannot go
-- stale; there is no second copy.
--
-- PRIVATE, not managerial. RLS is the user_profile pattern narrowed: only
-- `user_id = current_user_id()` reads or writes. Not workspace admins — this
-- answers "what should I do", it is not a report on somebody's day.
-- ============================================================================

create table if not exists public.user_task (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public."user"(id) on delete cascade,
  workspace_id  uuid not null references public.workspace(id) on delete cascade,

  title         text not null check (btrim(title) <> ''),
  -- A day, not a timestamp: a to-do belongs to a date. Null = no date yet.
  due_on        date,

  -- Which app it belongs to, and what it is about — the two groupings beside
  -- date. Both optional: a typed to-do may belong to neither.
  app_id        uuid references public.app(id) on delete set null,
  subject_kind  text check (subject_kind in ('person', 'organisation', 'thread', 'flow_run', 'booking', 'other')),
  subject_id    uuid,
  subject_label text,
  href          text,

  -- Set when this row is the answer to something an app owns. Unique per
  -- user, so ticking the same source twice cannot make two rows.
  source_app    text,
  source_ref    text,

  state         text not null default 'open' check (state in ('open', 'done', 'snoozed')),
  snoozed_until date,
  done_at       timestamptz,
  -- Hand ordering inside a day (drag, never a number the person types).
  sort          double precision not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint user_task_source_pair check ((source_app is null) = (source_ref is null)),
  constraint user_task_source_uniq unique nulls not distinct (user_id, source_app, source_ref)
);

comment on table public.user_task is
  'A person''s own to-do list across the apps. Typed items, and the ticked/snoozed state of items the apps own. Never a copy of app content. See 20260923060000 and docs/personal-todo-proposal.md.';

create index if not exists user_task_mine_idx
  on public.user_task (user_id, workspace_id, state, due_on);
create index if not exists user_task_done_idx
  on public.user_task (state, done_at) where state = 'done';

alter table public.user_task enable row level security;

create policy user_task_read on public.user_task
  for select to authenticated
  using (user_id = public.current_user_id());

create policy user_task_write on public.user_task
  for all to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id() and workspace_id = public.current_workspace_id());

-- updated_at, the way every other table here does it.
create or replace function public.user_task_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists user_task_touch on public.user_task;
create trigger user_task_touch before update on public.user_task
  for each row execute function public.user_task_touch();
