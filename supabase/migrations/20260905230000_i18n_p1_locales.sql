-- i18n P1 (docs/i18n-proposal.md, D1–D5 decided 2026-09-05).
--
-- 1. FRENCH joins the locale set (D4 overridden: fr now). thread.language's
--    CHECK was written in 20260702160000; that file is applied, so this is
--    a FRESH migration (never edit an applied one).
-- 2. D1 sharpening: thread.language conflated the FACILITATION language
--    (what the course is run in — the organiser's, informational) with the
--    PAGE/system language (buttons, emails — the platform's). language
--    keeps its existing job as the page/system language so every renderer
--    keeps working; facilitation_language is the new informational field
--    (free text on purpose — a thread can be facilitated in Greek even
--    though the chrome only speaks the platform's six; null = same as the
--    page language).
-- 3. Membership gets its locale carriers: the workspace's public default
--    on membership_settings (D5), and a per-member stamp captured from the
--    join page's active locale at join time — emails fire from schedulers
--    with no session, so the row must carry the answer (proposal §2.3.3).
--    Fallback chain everywhere: row locale → workspace default → en.

alter table public.thread_thread
  drop constraint thread_thread_language_check;
alter table public.thread_thread
  add constraint thread_thread_language_check
    check (language in ('en', 'nl', 'es', 'pt', 'de', 'fr'));

alter table public.thread_thread
  add column facilitation_language text;

alter table public.membership_settings
  add column locale text not null default 'en'
    check (locale in ('en', 'nl', 'es', 'pt', 'de', 'fr'));

alter table public.membership_member
  add column locale text
    check (locale in ('en', 'nl', 'es', 'pt', 'de', 'fr'));
