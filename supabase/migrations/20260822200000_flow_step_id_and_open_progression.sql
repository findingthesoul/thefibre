-- ============================================================================
-- Flow: a task knows its step, and a flow can be walked at your own pace.
-- docs/brief-flow-as-planner-engine.md items 4 + 6.
--
-- 1. flow_task.step_id
--    A task's step was DERIVED — through flow_step_default_task.step_id, or
--    through gate_task → transition → from_step_id. A manually created task
--    had neither, so it belonged to no step at all. That is a defect in Flow
--    today, not just something the planner wants: "add a task to this step" is
--    an ordinary thing to do and the row could not record it.
--
-- 2. flow_definition.progression
--    'gated'  — the state machine Flow has always been: one cursor, authored
--               edges, gates that hold a contact until required tasks are done.
--    'open'   — a sequence you move through at your own pace. Every step's
--               tasks exist from the moment the run starts, so all of them
--               have a real status immediately; no due dates are set, so
--               nothing can ever be overdue. Onboarding, learning paths, and
--               the Festival of Trust planner's nine steps.
--
--    The engine may be ABLE to express lateness; an open flow simply never
--    writes a due date, so there is nothing for a UI to surface. A schema that
--    can represent an overdue festival step would eventually show one.
-- ============================================================================

alter table public.flow_task
  add column if not exists step_id uuid references public.flow_step(id) on delete set null;

comment on column public.flow_task.step_id is
  'The step this task belongs to. Set for template-materialised tasks and for manual ones; null only for legacy rows whose step could not be recovered.';

create index if not exists flow_task_step_idx
  on public.flow_task (flow_run_id, step_id) where deleted_at is null;

-- Backfill from whichever template created the task.
update public.flow_task t
   set step_id = d.step_id
  from public.flow_step_default_task d
 where t.step_default_task_id = d.id
   and t.step_id is null;

update public.flow_task t
   set step_id = tr.from_step_id
  from public.flow_gate_task g
  join public.flow_transition tr on tr.id = g.transition_id
 where t.gate_task_id = g.id
   and t.step_id is null;

alter table public.flow_definition
  add column if not exists progression text not null default 'gated'
    check (progression in ('gated', 'open'));

comment on column public.flow_definition.progression is
  'gated = the state machine (cursor, authored edges, gates). open = a self-paced sequence: every step''s tasks materialise at run creation and no due dates are written, so nothing is ever overdue.';
