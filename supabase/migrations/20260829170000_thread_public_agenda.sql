-- Settings → Sharing gains a "Public agenda" switch (Sjoerd 2026-08-29).
-- The per-engagement flag (show_in_agenda) already decides which elements
-- make up the agenda; this is the thread-level master: off = the public page
-- shows no agenda at all, whatever the elements say.
-- Default TRUE — every public page today shows its agenda, and must keep it.
alter table public.thread_thread
  add column public_agenda boolean not null default true;
