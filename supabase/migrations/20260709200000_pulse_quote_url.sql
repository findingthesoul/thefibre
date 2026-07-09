-- Offer/quotation link on the opportunity (Sjoerd 2026-07-09, popup pt 12).
alter table public.pulse_commitment
  add column if not exists quote_url text;
