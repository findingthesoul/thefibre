-- ============================================================================
-- Fibre Flow — per-step notes on a run.
--
-- Free-text comments a team member leaves on a contact's journey, attached to
-- a (run, step) pair. App-private content: notes stay in Flow's tables and
-- never cross the data wall into the activity log (type + subject only).
-- ============================================================================

create table public.flow_run_note (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  flow_run_id  uuid not null references public.flow_run(id) on delete cascade,
  step_id      uuid references public.flow_step(id) on delete set null,
  body         text not null,
  created_by   uuid not null references public."user"(id),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index flow_run_note_run_idx on public.flow_run_note (flow_run_id) where deleted_at is null;

alter table public.flow_run_note enable row level security;

-- Visible/editable iff the parent run is visible (inherits flow_run RLS via
-- the EXISTS) and the caller has Flow membership in this workspace.
create policy flow_run_note_scope on public.flow_run_note
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-flow')
    and deleted_at is null
    and exists (select 1 from public.flow_run r where r.id = flow_run_note.flow_run_id)
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-flow')
  );
