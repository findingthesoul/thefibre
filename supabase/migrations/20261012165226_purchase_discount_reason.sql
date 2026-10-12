-- Why a purchase cost what it did.
--
-- Sjoerd, 2026-10-12, deciding the question that had been parked as
-- "€0-with-code enrolments in the ledger?": a member's discounted or free
-- join writes a purchase row carrying the price ACTUALLY PAID and a reason —
-- "included in membership" at €0 — with no invoice. A 100%-off coupon join
-- gets the same treatment with reason `coupon`. A thread whose list price is
-- €0 is not covered by that answer and keeps writing nothing.
--
-- The amount has always been recorded. The REASON has not, and a label is
-- not an answer to "why was this €7 and not €35?" — it reads, but nothing
-- can count it. /admin/economics will want to; a tier that has since been
-- edited cannot reconstruct it.
--
-- NULLABLE, and null means full price. Backfilling is deliberately NOT done:
-- the €0 coupon rows from 2026-07-04 carry their code in the item label and
-- inferring `coupon` from that text would be a guess written into a money
-- record. New rows carry the reason; old rows say nothing, which is honest.
alter table public.purchase
  add column if not exists discount_reason text
    check (discount_reason is null or discount_reason in ('coupon', 'membership'));

comment on column public.purchase.discount_reason is
  'Why the amount is below the list price: ''coupon'' (a discount code), ''membership'' (a team-calendar grant on the buyer''s membership), or NULL for full price. Written by the enrol path from the single price calculation in lib/member-discount.ts, so the row and the charge cannot disagree. Null on every row written before 2026-10-12.';
