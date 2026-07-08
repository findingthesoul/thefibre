-- ============================================================================
-- Cashflow per team (Sjoerd 2026-07-08). Commitments already carry team_id;
-- recurring budget lines gain one too (null = workspace-wide overhead), so a
-- hub's recurring items live in the hub's cashflow.
-- ============================================================================

alter table public.pulse_budget_line
  add column if not exists team_id uuid references public.team(id) on delete set null;
