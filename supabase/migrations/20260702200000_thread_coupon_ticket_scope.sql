-- Discount codes can apply to ALL tickets or one specific ticket
-- (Sjoerd 2026-07-02; v3 had the same). NULL = all tickets.
alter table public.thread_coupon
  add column ticket_id uuid references public.thread_ticket(id) on delete set null;
