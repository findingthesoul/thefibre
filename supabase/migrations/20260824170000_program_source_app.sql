-- ============================================================================
-- v0.18.0 — `program` learns which app created it, and on whose behalf.
--
-- docs/brief-thread-and-registrations.md §2. A festival is a `flow_run` in
-- Flow and a `program` + `thread_thread` in The Thread, and nothing connected
-- the two: the planner had to keep that mapping privately, and neither Flow's
-- UI nor The Thread's could show the other side.
--
-- `program` already carries `app_id` — "which app owns this programme". That
-- is not the same question as "which of that app's records is this", which is
-- what a link needs. `flow_run` answered it in 20260709080000 with
-- source_app / source_ref, and that pair has earned its keep: it is also what
-- makes creation idempotent, so a retried publish returns the existing row
-- instead of a second public page.
--
-- Same columns, same shape, deliberately. This is the third time the "which
-- app owns this mirrored row" question has come up, and a third convention
-- would be the actual mistake.
--
-- With this in place a planner sets `source_ref` to its own plan id on BOTH
-- the flow_run and the program, and the edge between them is derivable with
-- no join table.
-- ============================================================================

alter table public.program
  add column if not exists source_app text,
  add column if not exists source_ref uuid;

-- One programme per (app, its own record) per workspace. Partial, because the
-- overwhelming majority of programmes are created by a human in an app's own
-- UI and carry neither column.
create unique index if not exists program_source_ref_idx
  on public.program (workspace_id, source_app, source_ref)
  where source_app is not null and source_ref is not null;

create index if not exists program_source_app_idx
  on public.program (source_app)
  where source_app is not null;

comment on column public.program.source_app is
  'Slug of the external app that created this programme, when one did. NULL for programmes made by a person in an app''s own UI. Distinct from app_id, which says which app the programme belongs to.';
comment on column public.program.source_ref is
  'That app''s own id for the thing this programme mirrors. Unique per (workspace, source_app) — see program_source_ref_idx — which is what makes an app''s create idempotent.';
