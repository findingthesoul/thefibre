-- identity_billing_buyer_details
--
-- my.thread → Purchases, P2 (Sjoerd, 2026-10-15: "Manage payment should not
-- go to Stripe. We want to organise everything in THE FIBRE."): a person's
-- billing details as a BUYER — name, company, address, postal code, city,
-- country, VAT number — editable by them, stored here, keyed by email so they
-- follow the person across communities.
--
-- Read by the panel, the VAT rule (country, VAT number) and the join's
-- pre-fill (which the person sees and confirms). SYNCED TO the Stripe
-- customer on save, never read back from it. Each purchase keeps its own
-- snapshot in purchase.billing, so editing an address later never rewrites an
-- issued invoice.
--
-- Separate from invoice_details beside it, which is the person's identity as
-- a SELLER (what their own invoices say). Additive; nothing reads it until the
-- code that writes it ships.
alter table public.identity_billing
  add column if not exists buyer_details jsonb;
