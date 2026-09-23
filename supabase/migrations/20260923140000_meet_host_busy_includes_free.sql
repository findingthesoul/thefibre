-- "Most are set to FREE instead of BUSY" (Sjoerd, 2026-09-23).
--
-- Google's freebusy query reports only events the owner marked Busy, so a
-- calendar full of self-made blocks marked Free reads as an empty day and
-- Meet offers those hours. That is the right default for most people — a
-- free event means "book over this" — so this is a choice, per person,
-- not a change of behaviour.
--
-- ON: Meet reads the events themselves (calendar.readonly, already granted)
-- and treats every timed event as busy, whatever its transparency.
alter table public.meet_host
  add column if not exists busy_includes_free boolean not null default false;

comment on column public.meet_host.busy_includes_free is
  'When true, events marked Free in Google Calendar still block booking. Default false: freebusy semantics, where only Busy events block.';
