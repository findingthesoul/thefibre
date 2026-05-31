-- ============================================================================
-- Fibre Flow — auto-complete contact gate tasks from activity (Phase F).
--
-- When ANY app writes an activity for a person (Meet logs a booking, Thread
-- logs session attendance, etc.), close any open Flow *contact* gate task
-- whose `contact_action_type` matches the activity `type` for that person.
-- This is the cross-app magic: a contact does the thing → their gate turns
-- green, no manual logging.
--
-- Implemented as an AFTER INSERT trigger on public.activity. SECURITY DEFINER
-- so it can update flow_task regardless of who wrote the activity (Meet uses
-- the service role; Flow uses the user JWT). The activity table stays
-- append-only — we only read NEW and update a different table.
--
-- Scope note: this completes the matching *task*. It does NOT auto-advance the
-- run to the next step (which transition? branching?), so a human still
-- confirms the move — but the gate shows satisfied. Auto-advance is a future
-- enhancement.
-- ============================================================================

create or replace function public.flow_autocomplete_contact_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.flow_task t
     set status = 'done',
         completed_at = now()
    from public.flow_gate_task g
   where t.gate_task_id = g.id
     and t.status in ('open', 'in_progress')
     and t.actor_type = 'contact'
     and t.deleted_at is null
     and t.contact_id = new.person_id
     and t.workspace_id = new.workspace_id
     and g.contact_action_type is not null
     and g.contact_action_type = new.type;
  return new;
end;
$$;

revoke all on function public.flow_autocomplete_contact_tasks() from public;

drop trigger if exists flow_autocomplete_on_activity on public.activity;
create trigger flow_autocomplete_on_activity
  after insert on public.activity
  for each row
  execute function public.flow_autocomplete_contact_tasks();
