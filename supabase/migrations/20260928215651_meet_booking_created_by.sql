-- Who made this appointment.
--
-- Until now every booking came through the public page, so the answer was
-- always "the invitee" and there was nothing to record. A host can now add one
-- by hand (Sjoerd, 2026-09-28: "why can't I add an appointment through the
-- interface myself"), and the difference is not cosmetic — it changes what an
-- expiring Stripe session means.
--
-- On the public paid flow, the booking is created confirmed and holds the
-- slot while the invitee pays; if they wander off, `checkout.session.expired`
-- cancels it and releases the time. That is right there. It is wrong for a
-- booking a host made and then sent a payment link for: the appointment was
-- agreed, and an unpaid link is a debt, not a reason to cancel somebody's
-- meeting. The webhook now leaves host-created bookings alone, and this
-- column is how it can tell.
--
-- NULL means the invitee booked it themselves — the whole history to date.
alter table public.meet_booking
  add column if not exists created_by_user_id uuid references public."user"(id);

comment on column public.meet_booking.created_by_user_id is
  'The host who added this booking by hand. NULL = booked by the invitee through the public page. Read by the Stripe webhook: a host-created booking is never cancelled by an expiring checkout session.';
