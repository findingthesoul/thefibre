-- Payment destination per thread (Sjoerd 2026-07-02):
-- NULL = auto → team/workspace-shared threads default to the WORKSPACE
-- Stripe account; personal threads default to the organiser's PERSONAL
-- account when connected (else workspace). Explicit value overrides.
alter table public.thread_thread
  add column payment_destination text
    check (payment_destination in ('workspace', 'personal'));
