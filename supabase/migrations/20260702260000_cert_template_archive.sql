-- Certificate templates that threads use must not vanish (Sjoerd 2026-07-02:
-- "in gebruik → niet verwijderen, wel archiveren"). Archived templates stay
-- resolvable for the threads that point at them but disappear from pickers.
alter table public.thread_certificate_template
  add column archived_at timestamptz;
