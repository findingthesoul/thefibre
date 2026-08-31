-- Categories (Sjoerd 2026-08-31): a curated list — "It is not tags." Defined
-- in Settings, scoped to the workspace or to one organiser (organiser_id
-- null = workspace-wide); a thread picks one or more.
--
-- Slug is unique per WORKSPACE regardless of scope, so a public listing
-- filter (?category=festivals) is unambiguous — two organisers cannot mint
-- colliding "festivals" that mean different things on the same site.

create table public.thread_category (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id),
  organiser_id  uuid references public.thread_organiser(id) on delete cascade,
  name          text not null check (length(name) between 1 and 60),
  slug          text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table public.thread_thread_category (
  thread_id    uuid not null references public.thread_thread(id) on delete cascade,
  category_id  uuid not null references public.thread_category(id) on delete cascade,
  primary key (thread_id, category_id)
);

alter table public.thread_category enable row level security;
alter table public.thread_thread_category enable row level security;

create policy thread_category_rw on public.thread_category
  for all
  using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy thread_thread_category_rw on public.thread_thread_category
  for all
  using (exists (select 1 from public.thread_thread t
                 where t.id = thread_id
                   and t.workspace_id = public.current_workspace_id()))
  with check (exists (select 1 from public.thread_thread t
                      where t.id = thread_id
                        and t.workspace_id = public.current_workspace_id()));
