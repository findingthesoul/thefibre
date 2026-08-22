-- ============================================================================
-- Flow, reachable by an app key (docs/brief-flow-as-planner-engine.md).
--
-- The Festival of Trust planner runs its nine steps on Flow from OUTSIDE this
-- monorepo (Sjoerd, 2026-08-22: "It is an external app, that can communicate
-- with everything from Fibre: the Fibre, the Flow and also the Thread later").
-- v0.14.0 gave external apps a credential; this lets that credential own Flow
-- runs. Two things in the schema assumed a human was behind every write:
--
--  1. `created_by not null` on flow_task and flow_run_note. There is no user
--     behind an app key — `actorUserId()` returns null by design — so an app
--     creating a task or a note violated the constraint. Null now means "an
--     app wrote this", which is the truth; the owning app is recoverable from
--     the run's source_app, and for notes from app_id below.
--
--  2. flow_run_note had no way to tell an app's note from a person's. The
--     planner keeps ONE reflection per (run, step) and rewrites it, while a
--     human's notes on the same step are an append log. Without a
--     discriminator an app upsert would clobber a colleague's note. app_id
--     null = written by a person in Flow; non-null = owned by that app.
-- ============================================================================

alter table public.flow_task     alter column created_by drop not null;
alter table public.flow_run_note alter column created_by drop not null;

comment on column public.flow_task.created_by is
  'Null when an app key created the task — there is no human actor. See middleware/app-context.ts actorUserId().';
comment on column public.flow_run_note.created_by is
  'Null when an app key wrote the note. Pair with app_id to know which app.';

alter table public.flow_run_note
  add column if not exists app_id uuid references public.app(id) on delete cascade;

comment on column public.flow_run_note.app_id is
  'The app that owns this note. Null = a person wrote it in Flow. An app holds at most one note per (run, step) and rewrites it in place; a person''s notes stay an append log.';

-- One note per (run, step) per app — makes the app-facing upsert a real upsert
-- and stops two concurrent writes from an app leaving duplicates behind.
create unique index if not exists flow_run_note_app_step_idx
  on public.flow_run_note (flow_run_id, step_id, app_id)
  where app_id is not null and deleted_at is null;

-- RLS unchanged: reads/writes from an app key go through the API on the
-- service-role client, workspace- and run-scoped in the handler. The existing
-- policy still governs what a signed-in Flow member sees, and app-written
-- notes are visible to them exactly like any other note on the run.
