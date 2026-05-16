-- Adds capacity to meet_meeting_type for event_type='group'.
-- A group meeting type holds shared booking slots: multiple invitees can book
-- the same starts_at until the bookings count reaches `capacity`. Once full,
-- new booking attempts are rejected by the API (waitlist behind a follow-up).
--
-- Schema choice: capacity is nullable. Non-null only meaningful for 'group'
-- (we don't enforce that via CHECK so existing rows untouched). Grouping
-- bookings into a "slot" is done via (meeting_type_id, starts_at) tuple —
-- no extra slot_key column needed (an index for that tuple already exists).

alter table public.meet_meeting_type
  add column if not exists capacity integer
    check (capacity is null or capacity > 0);

comment on column public.meet_meeting_type.capacity is
  'Max invitees per slot for event_type=group. NULL = no cap (only meaningful for group event types).';
