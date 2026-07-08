-- ============================================================================
-- Pulse stages are a flow, not an enum (Sjoerd, 2026-07-08: "there should
-- be a default sales flow... one that can't be deleted once PULSE is
-- activated. The stages are a flow. The pipeline itself is a reflection of
-- a flow called pipeline").
--
-- pulse_stage: the workspace's pipeline flow. Pulse activation seeds the
-- default sales flow (Lead → Proposal → Committed → Done, plus Cancelled);
-- those rows are is_system and cannot be deleted, only relabelled/reordered.
-- Custom stages can be added between them. pulse_commitment.stage keeps its
-- text key (the seeded keys match the old enum values — zero data change);
-- the check constraint goes, validation moves to the API against this table.
--
-- `kind` carries the projection semantics, so the math stays configurable:
--   open      → weighted by the opportunity's probability
--   committed → counts at 100%, still expected money
--   won       → done; lines should be settling into actuals
--   lost      → excluded from every layer
-- ============================================================================

create table public.pulse_stage (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  key           text not null,
  label         text not null,
  kind          text not null default 'open'
                  check (kind in ('open','committed','won','lost')),
  sort_order    int not null default 0,
  is_system     boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (workspace_id, key)
);
create index pulse_stage_workspace_idx on public.pulse_stage (workspace_id, sort_order);

alter table public.pulse_stage enable row level security;

-- Read: any Pulse member (the stage list renders in every pipeline surface).
create policy pulse_stage_read on public.pulse_stage
  for select to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
  );

-- Insert/update: admins.
create policy pulse_stage_insert on public.pulse_stage
  for insert to authenticated
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  );
create policy pulse_stage_update on public.pulse_stage
  for update to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
  );

-- Delete: admins, and NEVER the system flow — the default sales flow ships
-- with Pulse and stays (RLS enforces it even if the API forgets).
create policy pulse_stage_delete on public.pulse_stage
  for delete to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-pulse')
    and public.is_workspace_admin()
    and is_system = false
  );

-- The old hardcoded enum goes; the API validates against pulse_stage now.
alter table public.pulse_commitment
  drop constraint if exists pulse_commitment_stage_check;

-- Seed the default sales flow for every workspace that has Pulse activated.
-- Keys deliberately match the old enum values, so existing commitments are
-- already pointing at valid stages.
insert into public.pulse_stage (workspace_id, key, label, kind, sort_order, is_system)
select w.id, s.key, s.label, s.kind, s.sort_order, true
  from public.workspace w
  join public.workspace_app wa on wa.workspace_id = w.id and wa.deactivated_at is null
  join public.app a on a.id = wa.app_id and a.slug = 'fibre-pulse'
  cross join (values
    ('lead',      'Lead',      'open',      1),
    ('proposal',  'Proposal',  'open',      2),
    ('committed', 'Committed', 'committed', 3),
    ('done',      'Done',      'won',       4),
    ('cancelled', 'Cancelled', 'lost',      5)
  ) as s(key, label, kind, sort_order)
on conflict (workspace_id, key) do nothing;
