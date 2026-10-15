-- thread_settings_card_dates
--
-- Thread dates part 3 (Sjoerd, 2026-10-16): what a thread CARD shows — the
-- event dates, the thread period, only the thread's start or only the first
-- event, plus "· N sessions" and "· Sign up by …". The workspace default,
-- chosen in Settings; each embed may override it (data-dates, data-sessions,
-- data-signup-by). Shape: {range, sessions, signup_by}; NULL = the default in
-- @thefibre/shared/thread-dates (DEFAULT_CARD_DATES). Additive.
alter table public.thread_settings
  add column if not exists card_dates jsonb;
