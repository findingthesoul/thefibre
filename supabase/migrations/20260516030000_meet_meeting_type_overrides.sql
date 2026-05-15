-- Per-meeting-type overrides for availability and conflict calendars.
--
-- Today every meeting type uses the host's working_hours and every calendar
-- the host marked as primary / conflict_check. A meeting type can now
-- override either:
--   * working_hours_override jsonb — same shape as meet_host.working_hours
--     (Schedule). NULL means use the host's default.
--   * conflict_calendar_ids uuid[] — meet_calendar.id values. NULL means
--     use the host's default (every primary / conflict_check / write_target
--     calendar).

alter table public.meet_meeting_type
  add column if not exists working_hours_override jsonb,
  add column if not exists conflict_calendar_ids  uuid[];
