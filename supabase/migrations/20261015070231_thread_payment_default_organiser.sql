-- A new thread's money goes to its ORGANISER by default.
--
-- Sjoerd, 2026-10-16: "Payment, by default to the organiser. Not to the
-- workspace." Until now a new thread was created with payment_destination
-- NULL ("auto"), which routes a team- or workspace-scoped thread's card
-- payments to the WORKSPACE account (lib/payment-accounts.ts
-- threadDestinationAccount).
--
-- A column default is the one place every create path shares — the editor,
-- the published /apps route, the MCP — so none of them can forget. EXISTING
-- threads keep exactly what they have: no row is updated here, because money
-- on a live thread is never re-routed silently. A duplicate or a template
-- copies its source's value explicitly, so those keep theirs too.
alter table public.thread_thread
  alter column payment_destination set default 'personal';
