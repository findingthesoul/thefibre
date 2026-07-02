-- Accepted payment methods per thread (Sjoerd 2026-07-02, mirroring Meet's
-- stripe|invoice): pay online now, by invoice, or both. The invoice flow
-- itself ports from Meet in the payments phase; the choice is stored now.
alter table public.thread_thread
  add column payment_methods text[] not null default '{stripe}';
