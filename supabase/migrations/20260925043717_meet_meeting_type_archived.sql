-- A meeting type you no longer offer.
--
-- Deleting one is usually impossible: meet_booking.meeting_type_id is a
-- non-null FK with no cascade, so Postgres refuses to remove anything that
-- has ever been booked — and those bookings are the record of real meetings
-- that happened. So retiring is archiving, and deleting is reserved for the
-- one you created by mistake and nobody used (Sjoerd, 2026-09-25).
--
-- Archiving always implies not published: every public route already filters
-- on is_active, so forcing it false here means an archived type disappears
-- from the booking page, the slots endpoint and the reschedule flow without
-- any of them learning a second rule.
alter table public.meet_meeting_type
  add column if not exists archived_at timestamptz;

comment on column public.meet_meeting_type.archived_at is
  'When the host retired this meeting type. Non-null = archived: hidden from the host''s own list (Archived tab) and never published. Existing bookings keep pointing at it.';

-- The host's list asks "mine, not archived" on every page load.
create index if not exists meet_meeting_type_archived_idx
  on public.meet_meeting_type (host_id, archived_at);
