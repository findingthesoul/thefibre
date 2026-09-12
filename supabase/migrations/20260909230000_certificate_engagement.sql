-- "Send certificate" becomes something you place on a timeline
-- (Sjoerd, 2026-09-09: "one extra engagement: send certificate").
--
-- Until now a certificate reached somebody one of two ways: automatically at
-- the moment they were marked complete, or an organiser pressing the bulk
-- button. Neither is a plan. A course that ends on the 14th and hands out
-- certificates on the 21st had nowhere to say so, and the organiser had to
-- remember.
--
-- So it joins the timeline as an element with a trigger, like everything else
-- there. Fixed date, relative to the thread's start or end, relative to
-- another item, or on completion — the same trigger machinery the scheduled
-- messages already use, because a certificate going out on a date IS a
-- scheduled send; it just sends a document rather than a paragraph.
--
-- A THIRD FAMILY, not a ninth message type. Several queries filter
-- `type IN (message types)` to mean "things that get emailed as a body", and
-- a ninth member would have been swept into every one of them silently, each
-- then needing an exclusion nobody would remember to add. A family of its own
-- forces each query that should include certificates to say so out loud.
alter table public.thread_engagement
  drop constraint if exists thread_engagement_type_check;

alter table public.thread_engagement
  add constraint thread_engagement_type_check check (type in (
    -- activities: timed, on the agenda
    'event', 'conversation', 'workshop',
    -- messages: scheduled sends, carrying a body
    'reflection', 'practice', 'message', 'document', 'inspiration',
    -- certificates: scheduled issuance, carrying no body
    'certificate'
  ));
