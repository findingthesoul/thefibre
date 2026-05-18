-- Persist Stripe Invoice references on paid bookings.
--
-- v0.10.x enabled Stripe's auto-invoice on Meet Checkout Sessions
-- (invoice_creation.enabled=true). Stripe generates a finalised PDF
-- invoice on the host's connected account and emails the invitee a
-- hosted link. We capture the references here so we can:
--   1. Surface a "View invoice (PDF)" link on the confirmation page,
--      so the invitee sees a real legal receipt and not just a
--      Stripe Checkout receipt.
--   2. Audit per-booking invoicing later (refunds, chargebacks).
--
-- Nullable: free bookings have neither; paid bookings before this
-- migration won't have a row stamped (one-time historical gap).

alter table public.meet_booking
  add column if not exists stripe_invoice_id  text,
  add column if not exists stripe_invoice_url text;

comment on column public.meet_booking.stripe_invoice_id  is
  'Stripe Invoice ID auto-created by Checkout (in_…) on the host''s connected account.';
comment on column public.meet_booking.stripe_invoice_url is
  'Stripe-hosted invoice URL (hosted_invoice_url) — public link the invitee can open to view + download the PDF.';
