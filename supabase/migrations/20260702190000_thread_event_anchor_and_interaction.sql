-- 1. Relative message triggers can anchor to a SPECIFIC activity (event)
--    in the thread, not just the thread start/end (Sjoerd 2026-07-02).
alter table public.thread_engagement
  add column trigger_engagement_id uuid
    references public.thread_engagement(id) on delete set null;

-- 2. How the public overview opens a thread: full thread page, or a
--    Luma-style popup with info + direct enrolment.
alter table public.thread_thread
  add column public_interaction text not null default 'page'
    check (public_interaction in ('page', 'popup'));
