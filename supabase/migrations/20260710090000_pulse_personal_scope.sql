-- Tabs are SEPARATE cashflows (Sjoerd 2026-07-10: "If I delete something
-- from ME it is also deleted from WORKSPACE" — it shouldn't appear there at
-- all). An item belongs to the cashflow it was created in: personal
-- (personal=true + owner), a team's (team_id), or the workspace's (neither).
-- Existing rows default to workspace, the shared pool they were living in.
alter table public.pulse_commitment
  add column if not exists personal boolean not null default false;
create index if not exists pulse_commitment_scope_idx
  on public.pulse_commitment (workspace_id, personal, team_id);
