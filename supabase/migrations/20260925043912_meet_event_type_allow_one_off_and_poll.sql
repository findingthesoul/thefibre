-- One-off and Meeting poll have never been creatable.
--
-- 20260517210000 added the tables, the columns and the UI for both, and
-- widened no constraint. `event_type`'s CHECK has listed the same four values
-- since 20260515040000, so every attempt to save a poll or a one-off has been
-- refused by the database for four months:
--
--   API 500: new row for relation "meet_meeting_type" violates check
--   constraint "meet_meeting_type_event_type_check"
--
-- Reported by Sjoerd on 2026-09-25, trying to create a Meeting poll.
--
-- A personal poll trips a SECOND constraint behind that one. The
-- team_only_multihost rule says "anything but one_on_one/group needs a team",
-- which was written when the only other values were round_robin and
-- collective — the genuinely multi-host ones. A one-off and a poll have a
-- single host, so they belong with one_on_one, not behind a team.

alter table public.meet_meeting_type
  drop constraint if exists meet_meeting_type_event_type_check;

alter table public.meet_meeting_type
  add constraint meet_meeting_type_event_type_check
  check (event_type in ('one_on_one','round_robin','collective','group','one_off','poll'));

alter table public.meet_meeting_type
  drop constraint if exists meet_meeting_type_team_only_multihost;

alter table public.meet_meeting_type
  add constraint meet_meeting_type_team_only_multihost
  check (
    event_type in ('one_on_one','group','one_off','poll') or team_id is not null
  );
