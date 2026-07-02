-- Email sender identity (Sjoerd 2026-07-02): the from-name on thread emails
-- is a choice — workspace name, the thread's team name, the organiser's
-- personal name, or a custom fill-in (email_from_name).
alter table public.thread_settings
  add column email_from_mode text not null default 'workspace'
    check (email_from_mode in ('workspace', 'team', 'personal', 'custom'));
