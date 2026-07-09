-- Per-day timing for multi-day engagements (Sjoerd 2026-07-10).
-- When null → the engagement uses its single starts_at/ends_at range (today's
-- behaviour). When present → an array of per-day wall-clock times, one object
-- per day: [{ "date": "2026-03-02", "start": "09:00", "end": "17:00" }, ...].
-- starts_at/ends_at stay populated as the outer envelope (first day start /
-- last day end) so sorting, the "when" anchor and the scheduler keep working.
alter table public.thread_engagement
  add column if not exists daily_schedule jsonb;
