-- ============================================================================
-- Fibre Flow — new step kind: 'loop'.
--
-- A loop step closes a cycle: when a run transitions into it, the runtime
-- immediately returns the contact to the version's entry step (fresh entry
-- tasks, activity logged as "looped back via <step>"). Models the briefing's
-- "Waitlisted (loops back)" pattern without hand-drawing a return edge.
-- ============================================================================

alter table public.flow_step drop constraint if exists flow_step_kind_check;
alter table public.flow_step add constraint flow_step_kind_check
  check (kind in ('entry', 'normal', 'end_positive', 'end_negative', 'loop'));
