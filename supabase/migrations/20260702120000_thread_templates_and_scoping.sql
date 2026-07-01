-- Template scoping + thread templates (Sjoerd 2026-07-02):
-- Templates (certificate + thread) live at personal / team / workspace level.
-- Workspace-level templates can be granted to selected users and teams via
-- thread_template_share (no shares = visible to the whole workspace).

alter table public.thread_certificate_template
  add column scope text not null default 'personal'
    check (scope in ('personal', 'team', 'workspace')),
  add column owner_user_id uuid references public."user"(id) on delete cascade,
  add column owner_team_id uuid references public.team(id) on delete cascade;

-- thethread-v3's `templates` — a thread + its engagements captured with
-- RELATIVE timing (day_offset / time_of_day / duration) so instantiating
-- rebases onto a new start date. Structure doc: docs/thread-rebuild-plan.md.
create table public.thread_template (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspace(id) on delete cascade,
  title          text not null,
  scope          text not null default 'personal'
                   check (scope in ('personal', 'team', 'workspace')),
  owner_user_id  uuid references public."user"(id) on delete cascade,
  owner_team_id  uuid references public.team(id) on delete cascade,
  structure      jsonb not null,
  created_by     uuid references public."user"(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index thread_template_workspace_idx on public.thread_template (workspace_id);

create table public.thread_template_share (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspace(id) on delete cascade,
  template_kind     text not null check (template_kind in ('certificate', 'thread')),
  template_id       uuid not null,
  grantee_user_id   uuid references public."user"(id) on delete cascade,
  grantee_team_id   uuid references public.team(id) on delete cascade,
  created_at        timestamptz not null default now(),
  check (grantee_user_id is not null or grantee_team_id is not null)
);
create index thread_template_share_template_idx
  on public.thread_template_share (template_kind, template_id);

alter table public.thread_template enable row level security;
alter table public.thread_template_share enable row level security;

create policy thread_template_scope on public.thread_template
  for all to authenticated
  using (workspace_id = public.current_workspace_id()
         and public.has_app_membership('the-thread'))
  with check (workspace_id = public.current_workspace_id()
              and public.has_app_membership('the-thread'));

create policy thread_template_share_scope on public.thread_template_share
  for all to authenticated
  using (workspace_id = public.current_workspace_id()
         and public.has_app_membership('the-thread'))
  with check (workspace_id = public.current_workspace_id()
              and public.has_app_membership('the-thread'));
