-- Per-engagement image (Sjoerd 2026-09-05: "Should events not have an option
-- for a unique image in a thread?"). Threads carry one cover_url; the events
-- on the timeline had none. Nullable text URL, same shape as cover_url —
-- uploaded through the existing /api/v1/thread/uploads path.

alter table public.thread_engagement add column if not exists image_url text;
