-- ============================================================================
-- P4 opt-in (Sjoerd 2026-07-08: "A setting on profile level: add invoices to
-- the sales pipeline... based on payment moments of Stripe settings").
-- When enabled, unpaid purchase-ledger rows (Stripe/invoice money events
-- from Meet + Thread) appear in the cashflow as receivables. Paid rows are
-- already in the bank balances — only open ones project forward.
-- ============================================================================

alter table public.pulse_settings
  add column if not exists include_ledger boolean not null default false,
  -- Expected settlement lag for open invoices, in days (payment terms).
  add column if not exists ledger_terms_days int not null default 14
    check (ledger_terms_days between 0 and 120);
