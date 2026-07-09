-- Manual row order under Income/Costs (Sjoerd 2026-07-09): drag to reorder.
alter table public.pulse_commitment
  add column if not exists sort_order int not null default 0;
create index if not exists pulse_commitment_sort_idx
  on public.pulse_commitment (workspace_id, direction, sort_order);
