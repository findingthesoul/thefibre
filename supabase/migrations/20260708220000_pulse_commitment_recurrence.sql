-- ============================================================================
-- Recurring is a CHARACTERISTIC of an income/cost, not a separate thing
-- (Sjoerd 2026-07-08: "Recurring is an income or costs characteristic...
-- not a separate. Opportunity is just income. It does not need to be a
-- separate item"). A commitment may repeat: cadence + window; occurrences
-- are expanded at projection time from the deal amount (quantity × unit).
-- pulse_budget_line remains for counterparty-less overhead entered on the
-- Budget page, but the dialog now expresses repetition directly.
-- ============================================================================

alter table public.pulse_commitment
  add column if not exists repeat_cadence text
    check (repeat_cadence in ('weekly','fortnightly','monthly','quarterly','yearly')),
  add column if not exists repeat_starts_on date,
  add column if not exists repeat_until date;
