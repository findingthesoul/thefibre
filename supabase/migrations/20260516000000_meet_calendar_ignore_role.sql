-- Allow 'ignore' as a meet_calendar.role so users can keep the row but
-- explicitly opt the calendar out of conflict checking. Without this they'd
-- have to delete-and-resync, which loses the user's prior choice on next sync.

alter table public.meet_calendar
  drop constraint meet_calendar_role_check;

alter table public.meet_calendar
  add constraint meet_calendar_role_check
  check (role in ('primary','conflict_check','write_target','ignore'));
