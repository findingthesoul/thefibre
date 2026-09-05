-- One-off payment-link checkout sessions for MEMBERSHIP invoices live on the
-- purchase row itself (Thread keeps its session on thread_enrolment). A
-- resend/mark-paid must be able to expire the previous session — double-pay
-- guard, same rule as Thread.
alter table public.purchase
  add column if not exists stripe_session_id text;
