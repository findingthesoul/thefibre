-- When the host was never asked, say so on the booking.
--
-- A booking that requires approval mails the host "Approval needed". If that
-- send throws, the old code logged a line and carried on: the request sat in
-- `pending_approval` looking exactly like one the host had seen and not yet
-- answered. On production a real request waited that way while another
-- meeting was booked over its slot, and nothing in the system could tell the
-- two cases apart after the fact.
--
-- So the failure lands on the row. Null means the ask went out (or has not
-- been attempted yet); a timestamp means the last attempt to tell the host
-- failed, and /bookings says so where the host will see it.
--
-- Cleared on a later successful ask — moving a pending booking re-asks, and a
-- stale failure flag must not outlive the problem.

alter table public.meet_booking
  add column if not exists approval_notice_failed_at timestamptz;

comment on column public.meet_booking.approval_notice_failed_at is
  'Set when the "Approval needed" email to the host failed; null when the host was reached. Surfaced in /bookings so an unasked request is visible rather than silent.';
