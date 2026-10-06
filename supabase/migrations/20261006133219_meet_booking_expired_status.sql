-- A booking request that was never answered: `expired`.
--
-- Since the previous migration a request awaiting the host's approval HOLDS
-- its slot, which is what a waiting invitee expects and what was missing when
-- a real request was booked over. The cost is that an unanswered request
-- would park somebody else's time forever, so a request now lets go by
-- itself: the earlier of 48 hours after it was made or the meeting's own
-- start time (apps/api/src/lib/meet/request-expiry.ts).
--
-- `expired` is TERMINAL and, crucially, is NOT in the code's
-- LIVE_BOOKING_STATUSES — which is what frees the slot. Nothing else needs to
-- change for that: the ten availability and capacity queries all ask the one
-- rule, so a status they do not name stops blocking the moment it is set.
--
-- It is a separate status from `cancelled` on purpose. Cancelled is somebody's
-- decision — the invitee withdrew or the host declined. Expired is nobody's:
-- it means the request was never answered, which is a different thing to show
-- an invitee and a different thing to count later.
--
-- The CHECK constraint cannot be ALTERed in place; drop + re-add, as
-- 20260517240000 did when it added pending_approval.

alter table public.meet_booking
  drop constraint if exists meet_booking_status_check;

alter table public.meet_booking
  add constraint meet_booking_status_check
    check (status in ('confirmed', 'cancelled', 'rescheduled', 'pending_approval', 'expired'));

-- The sweep asks for pending requests by age and by start time, every five
-- minutes, across every workspace. Without this it is a full scan of the
-- table on each tick.
create index if not exists meet_booking_pending_expiry_idx
  on public.meet_booking (status, starts_at, created_at)
  where status = 'pending_approval';
