-- Invoice-method purchases carry billing details (Sjoerd 2026-07-04):
-- company, billing address, tax/VAT number — collected on the enrol form
-- when "receive an invoice" is chosen, surfaced in the Invoices area.
alter table public.thread_enrolment
  add column if not exists billing jsonb;
alter table public.purchase
  add column if not exists billing jsonb;
