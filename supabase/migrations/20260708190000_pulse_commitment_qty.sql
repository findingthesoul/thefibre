-- ============================================================================
-- Opportunities carry an amount as quantity × unit price (Sjoerd 2026-07-08:
-- "amount should be added in the opportunity, e.g. 16 * product x / € 1.350").
-- The workbook's material rows (units × price) worked the same way. The
-- payment lines stay the schedule; qty × unit is the deal-size expression.
-- ============================================================================

alter table public.pulse_commitment
  add column if not exists quantity numeric(12,2) not null default 1,
  add column if not exists unit_amount_cents bigint;
