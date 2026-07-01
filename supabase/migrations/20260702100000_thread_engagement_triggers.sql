-- Thread engagement triggers (Sjoerd 2026-07-02):
-- Activities must fall inside the thread's date window (enforced in the API,
-- where the paired program row is at hand). Message-family engagements gain
-- a trigger model beyond a fixed date:
--   fixed          → send at scheduled_at (existing behaviour)
--   on_enrolment   → sent to a person the moment they enrol
--   on_approval    → sent when their enrolment is approved (threads with
--                    requires_approval)
--   on_completion  → sent when their enrolment completes
--   relative       → N days before/after the thread start/end, at a set time
alter table public.thread_engagement
  add column trigger_kind text not null default 'fixed'
    check (trigger_kind in ('fixed','on_enrolment','on_approval','on_completion','relative')),
  add column trigger_anchor text
    check (trigger_anchor in ('start','end')),
  add column trigger_offset_days integer,   -- signed: negative = before anchor
  add column trigger_time text;             -- 'HH:MM' in the thread's timezone
