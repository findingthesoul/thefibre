-- Seller identity for invoices/receipts (Sjoerd 2026-07-04): the invoice
-- issuer's legal name, address and tax/VAT number — at both payout levels.
-- {legal_name, address, tax_no}
alter table public.thread_organiser
  add column if not exists invoice_details jsonb;
alter table public.thread_settings
  add column if not exists invoice_details jsonb;
