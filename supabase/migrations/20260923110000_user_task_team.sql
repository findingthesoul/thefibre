-- A to-do says which TEAM it is for.
--
-- Sjoerd, 2026-09-23: *"Do to do's: from which team.. (not workspace)"* — the
-- correction matters. A workspace is everything he runs; a team is the actual
-- unit of work, and it is the "project" axis his original ask named ("per
-- date/app/project").
--
-- This changes nothing about whose list it is. The row is still yours and
-- only yours — the RLS policies are untouched, and `team_id` is a LABEL on
-- your own item, not a share. Nobody else sees your to-do because you tagged
-- it with a team you are both in.
--
-- `on delete set null`: a team being dissolved must not take somebody's
-- to-dos with it. The item survives, unlabelled.

alter table public.user_task
  add column if not exists team_id uuid references public.team(id) on delete set null;

comment on column public.user_task.team_id is
  'Which team this to-do is for. A label on your own row — never a share; RLS still limits every row to its own user.';

create index if not exists user_task_team_idx
  on public.user_task (user_id, team_id)
  where team_id is not null and deleted_at is null;
