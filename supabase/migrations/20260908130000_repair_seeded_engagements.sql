-- Repair the rows the v0.67.1 template seeder wrote wrong (found 2026-09-08
-- when the Thread editor crashed on a thread made from "two-day event").
--
-- 1. daily_schedule rows without a date: the editor formats each row's date
--    with Intl, which throws on undefined and takes the page down. A
--    template has no dates to give, so the schedule goes back to null and
--    the organiser picks the days in the dialog.
-- 2. Relative messages seeded with trigger_engagement_id but trigger_anchor
--    null: both the editor and the scheduler branch on anchor = 'engagement',
--    so these silently resolved to the programme start instead of the
--    element they name.

update public.thread_engagement
   set daily_schedule = null
 where daily_schedule is not null
   and exists (
     select 1
       from jsonb_array_elements(daily_schedule) d
      where d ->> 'date' is null
   );

update public.thread_engagement
   set trigger_anchor = 'engagement'
 where trigger_kind = 'relative'
   and trigger_engagement_id is not null
   and trigger_anchor is null;
