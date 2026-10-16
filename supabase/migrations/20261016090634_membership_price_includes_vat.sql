-- "Price includes VAT" per tier and per product (Sjoerd, 2026-10-16; plan
-- approved by the coordinator). Default FALSE: every existing price stays
-- EXCL. VAT ("Everything excl. VAT now"), so nothing changes for any member,
-- subscription or price until a row is switched on.
--
-- When TRUE (and only for a VAT-registered community), the entered price is
-- what a buyer at the community's home rate pays; the server derives the net
-- once (netFromInclusive, @thefibre/shared/price-logic) and charges through
-- the one excl. pipeline. A tier's flag covers its yearly AND monthly price.
-- A running subscription keeps the net it started with — flipping this never
-- reprices anyone.
--
-- Migration only; no code reads these until the next release.

alter table public.membership_tier
  add column if not exists price_includes_vat boolean not null default false;

alter table public.membership_product
  add column if not exists price_includes_vat boolean not null default false;
