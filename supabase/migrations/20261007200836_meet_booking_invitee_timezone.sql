-- The guest's own timezone, stored on the booking.
--
-- Live feedback from a real guest on production, 2026-10-07: a confirmation
-- for 22:00–22:30 CEST reached somebody in US Eastern, where it was 16:00.
-- The email showed only CEST, the host's zone, because that is the only zone
-- the booking knew: `meet_host.timezone` is the host's and nothing recorded
-- the guest's.
--
-- The booking page has always known it. It detects the browser's zone and
-- shows a picker the guest can change, because the slot list has to be in the
-- guest's own hours to be readable at all — and then the POST that created
-- the booking dropped it on the floor. So this column is not new information;
-- it is information that was already on screen and never written down.
--
-- Nullable, and that is the safety property: every booking made before today
-- has no zone, and every guest-facing mail falls back to exactly the host
-- zone it prints now. Only new bookings gain the guest's local time.
--
-- NOT validated here. An IANA name cannot be checked by a CHECK constraint
-- (`pg_timezone_names` is a function, and a subquery is not allowed in one),
-- so the API validates at the door with `isTimeZone` from
-- @thefibre/shared/timezone and the renderer survives a bad value anyway.
-- That pairing is deliberate: on 2026-09-28 a single unvalidated timezone
-- string ('Athenes', a typo) took down every signed-in page, because one
-- layer trusted the other to have checked.
alter table public.meet_booking
  add column if not exists invitee_timezone text;

comment on column public.meet_booking.invitee_timezone is
  'IANA timezone the guest booked in, as their browser reported it or as they picked it. Written once at booking; used to show guest-facing times in their own zone, with the host''s second. NULL for bookings made before 2026-10-07 and for any path that cannot know it — guest mail then reads in the host''s zone, as it did before.';

-- ---------------------------------------------------------------------------
-- And the invitation's SEQUENCE.
-- ---------------------------------------------------------------------------
-- The same guest asked for "a normal calendar invite", so the confirmation
-- now carries one as an attachment (METHOD:REQUEST) instead of only linking
-- to a METHOD:PUBLISH file — which is what his phone offered to SUBSCRIBE to
-- rather than file as an event.
--
-- Once an event is in somebody's calendar, moving it means sending an UPDATE
-- that the calendar accepts, and a calendar accepts an update only if its
-- SEQUENCE is HIGHER than the one it already holds. Equal or lower is
-- ignored, silently, and the guest keeps the old time — worse than never
-- having had the event, because now they trust it.
--
-- So the number lives on the row and rises when the booking moves. Starting
-- at 0 is right for every existing booking too: none of them ever sent a
-- REQUEST, so nothing out there holds a sequence to beat.
alter table public.meet_booking
  add column if not exists invite_sequence integer not null default 0;

comment on column public.meet_booking.invite_sequence is
  'iCalendar SEQUENCE for this booking''s invitation. Rises on every reschedule; a calendar ignores an update numbered at or below what it holds. Read and written only through lib/meet-invite.ts and the reschedule path.';
