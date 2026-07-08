-- ============================================================================
-- Flow runs can carry another app's items (Sjoerd 2026-07-08: "When
-- opportunities are in the pipeline (Pulse), they should of course also be
-- visible in FLOW"). Runtime half of the Pulse↔Flow integration: every
-- Pulse opportunity becomes a run on the Pipeline flow, moving between
-- steps as its stage changes — and moving it in Flow moves the stage.
--
-- flow_run grows external-subject support:
--  - person_id becomes nullable (an opportunity may belong to an org, or
--    to no counterparty yet)
--  - subject_label: what to display when there is no person
--  - source_app / source_ref: which app owns the mirrored item (unique per
--    flow so syncs are idempotent)
-- ============================================================================

alter table public.flow_run
  alter column person_id drop not null,
  add column if not exists subject_label text,
  add column if not exists source_app text,
  add column if not exists source_ref uuid;

create unique index if not exists flow_run_source_idx
  on public.flow_run (flow_id, source_app, source_ref)
  where source_app is not null and deleted_at is null;
