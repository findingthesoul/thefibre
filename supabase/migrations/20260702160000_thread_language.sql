-- Public-surface language per thread (Sjoerd 2026-07-02). The thread's
-- public page, enrol flow, embeds and transactional emails render in this
-- language. Catalog lives in apps/thread/lib/i18n.ts (typed: adding a key
-- without all five translations fails typecheck).
alter table public.thread_thread
  add column language text not null default 'en'
    check (language in ('en', 'nl', 'es', 'pt', 'de'));
