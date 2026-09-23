-- ============================================================================
-- A thread has a to-do list, and it belongs to the THREAD, not to a person.
--
-- Sjoerd, 2026-09-23: *"I want per thread a to do list... In a thread, there
-- should be a to do list button... so organisisers and hosts can see what
-- needs to happen."*
--
-- WHY THIS IS NOT public.user_task
-- ---------------------------------------------------------------------------
-- The platform list shipped a day earlier (20260923060000) and is PRIVATE by
-- construction: its policies are `user_id = current_user_id()`, and its own
-- comment says "not managerial... it is not a report on somebody's day". A
-- list every organiser and host of a thread can see is the opposite of that.
-- Widening user_task to carry it would have taken the promise away from the
-- personal list to pay for this one.
--
-- So this is what the data wall already prescribes: the APP owns its content,
-- and the platform composes. A thread's to-dos are Thread's content, exactly
-- like its engagements, its tickets and its certificates. The personal list
-- picks up the ones ASSIGNED TO YOU as a source, labelled `the-thread` and
-- gated on a Thread seat — reference and label, never a copy (see
-- apps/api/src/routes/my-tasks.ts, the three rules at the top).
--
-- The consequence worth stating out loud: this table is NOT behind the
-- Organisation-plan `todo` gate. That gate belongs to the cross-app personal
-- list at /api/v1/tasks. A thread's own checklist is part of The Thread, and
-- reaches anyone whose plan includes The Thread.
--
-- WHOSE EYES
-- ---------------------------------------------------------------------------
-- The policy is thread_engagement's, unchanged: the workspace, plus a Thread
-- seat. Everyone who can already open the thread and edit its timeline can
-- see and tick its to-dos. Assignment is a LABEL saying who is expected to do
-- it — it is not a permission, and it hides nothing from anybody.
--
-- SOFT DELETE (hard rule 4): a to-do's title is free text and can name a real
-- person ("ring Marja about the room"), so removing one sets deleted_at.
--
-- WHY 150000 AND NOT 140000, which is what this file was first called:
-- another session, working in its own worktree on Meet, had already applied
-- 20260923140000_meet_host_busy_includes_free.sql to staging. Supabase
-- records a migration by its VERSION NUMBER, not its filename or its
-- contents, so the moment that version existed remotely this file was
-- considered applied and `supabase db push` skipped it WITHOUT SAYING SO —
-- the push log listed only the sibling migration and exited 0. The table
-- simply was not there afterwards. Two sessions in disjoint lanes, editing
-- no common file, collided through a shared timestamp: the same class as the
-- machine-global `supabase link`. Check the other worktrees' migration
-- directories, not just this one, before choosing a timestamp.
-- ============================================================================

create table if not exists public.thread_task (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  thread_id     uuid not null references public.thread_thread(id) on delete cascade,

  title         text not null check (btrim(title) <> ''),
  notes         text,

  -- A day, not a timestamp — the same choice user_task made, for the same
  -- reason: a to-do belongs to a date. Null = no date yet.
  due_on        date,

  -- Who is expected to do it. Null = nobody yet, and it stays on the thread
  -- list only. A LABEL, never a permission: see WHOSE EYES above.
  assignee_user_id uuid references public."user"(id) on delete set null,

  -- Which team it is for. Inherited from the thread when the to-do is made
  -- ("Auto team if selected") so nobody files it by hand, and kept here
  -- rather than read through the thread because a thread can be moved between
  -- teams afterwards and that must not silently re-file work already done.
  team_id       uuid references public.team(id) on delete set null,

  status        text not null default 'open' check (status in ('open', 'done')),
  done_at       timestamptz,
  done_by       uuid references public."user"(id) on delete set null,

  -- Hand ordering (drag, never a number somebody types — CLAUDE.md).
  position      double precision not null default 0,

  -- Set when the row came from a to-do template, so the thread can say where
  -- its list came from. The template id only; never a copy of its title.
  source_template_id uuid references public.thread_template(id) on delete set null,

  created_by    uuid references public."user"(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

comment on table public.thread_task is
  'A thread''s own to-do list — Thread content, shared with everyone who can open the thread. NOT public.user_task, which is private to one person. See 20260923150000.';
comment on column public.thread_task.assignee_user_id is
  'Who is expected to do it. A label, not a permission — every Thread user in the workspace still sees the row.';
comment on column public.thread_task.team_id is
  'Inherited from the thread when the to-do is made. Kept here so moving the thread between teams does not re-file finished work.';

create index if not exists thread_task_thread_idx
  on public.thread_task (thread_id, status, position)
  where deleted_at is null;

-- The personal list's source query: "open to-dos assigned to me". Ordered by
-- the column it sorts on, so that read needs no sort of its own.
create index if not exists thread_task_assignee_idx
  on public.thread_task (assignee_user_id, workspace_id, status, due_on)
  where deleted_at is null and assignee_user_id is not null;

alter table public.thread_task enable row level security;

-- thread_engagement's policy, word for word. A to-do is as visible as the
-- timeline item it sits beside.
create policy thread_task_scope on public.thread_task
  for all to authenticated
  using (workspace_id = public.current_workspace_id()
         and public.has_app_membership('the-thread'))
  with check (workspace_id = public.current_workspace_id()
              and public.has_app_membership('the-thread'));

create or replace function public.thread_task_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists thread_task_touch on public.thread_task;
create trigger thread_task_touch before update on public.thread_task
  for each row execute function public.thread_task_touch();
