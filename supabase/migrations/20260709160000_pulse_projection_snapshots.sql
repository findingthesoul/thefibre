-- ============================================================================
-- Projection history (Sjoerd 2026-07-09: "save an image every X days/weeks…
-- stores an overview of that moment… keeps it 2 years at max… for
-- comparison purposes"). Not literal images: the full projection payload as
-- it stood, captured on a cadence, pruned past two years.
-- ============================================================================

create table public.pulse_projection_snapshot (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  taken_at      timestamptz not null default now(),
  granularity   text not null,
  payload       jsonb not null
);
create index pulse_projection_snapshot_ws_idx
  on public.pulse_projection_snapshot (workspace_id, taken_at desc);

alter table public.pulse_projection_snapshot enable row level security;

-- Money surface: admin+ read. Writes happen service-side on capture.
create policy pulse_projection_snapshot_read on public.pulse_projection_snapshot
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  );

alter table public.pulse_settings
  add column if not exists snapshot_cadence_days int
    check (snapshot_cadence_days is null or snapshot_cadence_days between 1 and 90),
  add column if not exists snapshot_last_at timestamptz;
