-- member_page_and_held_threads
--
-- Threads the circuit breaker HELD (lib/member-notify.ts: more than 20 newly
-- visible in one community in one pass) are recorded as seen and announced
-- to nobody. That keeps an import or a restore from emailing a whole
-- community — but it also swallows an organiser loading a year's agenda in
-- one sitting, which is exactly what Sjoerd asked to be told about. So a held
-- thread is now marked, and an admin decides in Members → Settings → Member
-- notifications: "Tell members now" (one digest) or "Don't announce".
--
-- held_at null = not held: a baseline row, a switch-off row, an announced
-- one, or a hold an admin has already decided. Additive; nothing reads it
-- until the code that writes it ships.

alter table public.thread_calendar_seen
  add column if not exists held_at timestamptz;

create index if not exists thread_calendar_seen_held_idx
  on public.thread_calendar_seen (workspace_id)
  where held_at is not null;

-- ---------------------------------------------------------------------------
-- THE COMMUNITY PAGE (item 4): an admin-written intro and uploaded documents
-- that a community's members see in my.thread. Edited in Members → Settings →
-- Member page. Shape:
--   { "intro_html": "<p>…</p>",   -- sanitised on the way in (lib/rich-text)
--     "documents": [ { "id", "title", "path", "mime", "bytes", "uploaded_at" } ] }
-- Additive; null = no page written yet.
alter table public.membership_settings
  add column if not exists member_page jsonb;

-- The documents themselves, in a PRIVATE bucket. No storage policies on
-- purpose: only the service role reaches it. A member downloads through the
-- API, which checks they are an active or grace member of that community and
-- answers with a signed URL valid for 60 seconds — so a forwarded link stops
-- working within a minute.
insert into storage.buckets (id, name, public)
values ('member-documents', 'member-documents', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- THREAD SLUG HISTORY (item 5): a thread's earlier addresses, so renaming a
-- thread does not break the links people already have — the public page,
-- an embed, a product link, a grant written before grants held ids. Written
-- by the API when a slug changes; read when a public lookup by slug finds
-- nothing. One row per (thread, old slug); the newest wins on a reused slug.
create table if not exists public.thread_slug_history (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.thread_thread(id) on delete cascade,
  workspace_id uuid not null references public.workspace(id) on delete cascade,
  old_slug    text not null,
  changed_at  timestamptz not null default now(),
  unique (thread_id, old_slug)
);
create index if not exists thread_slug_history_lookup
  on public.thread_slug_history (workspace_id, old_slug, changed_at desc);

alter table public.thread_slug_history enable row level security;
-- No policies on purpose: reached only through the API.
