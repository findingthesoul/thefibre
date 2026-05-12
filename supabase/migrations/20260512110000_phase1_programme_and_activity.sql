-- ============================================================================
-- Phase 1 — programme, enrolment, activity log
-- See: docs/fibre-technical-brief-v0.3.md §5 Domains 5–6
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Domain 5: programme and enrolment (shared across all apps)
-- ---------------------------------------------------------------------------
create table public.program (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id),
  app_id        uuid not null references public.app(id),
  title         text not null,
  format        text not null check (format in ('meeting','event','journey','self_paced','blended')),
  status        text not null default 'draft'
                check (status in ('draft','active','completed','archived')),
  starts_on     date,
  ends_on       date,
  created_at    timestamptz not null default now()
);
create index program_workspace_idx on public.program (workspace_id, status);
create index program_app_idx       on public.program (app_id);

create table public.enrolment (
  id                uuid primary key default gen_random_uuid(),
  program_id        uuid not null references public.program(id) on delete cascade,
  person_id         uuid not null references public.person(id),
  status            text not null default 'invited'
                    check (status in ('invited','enrolled','active','completed','dropped')),
  progress_pct      integer not null default 0 check (progress_pct between 0 and 100),
  current_lesson_id uuid,
  enrolled_at       timestamptz,
  completed_at      timestamptz,
  unique (program_id, person_id)
);
create index enrolment_person_idx  on public.enrolment (person_id);
create index enrolment_program_idx on public.enrolment (program_id, status);

-- ---------------------------------------------------------------------------
-- Domain 6: activity log
-- Append-only. Type + subject only. Body of content NEVER stored here.
-- See: developer rule §13.7
-- ---------------------------------------------------------------------------
create table public.activity (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id),
  person_id     uuid not null references public.person(id),
  app_id        uuid not null references public.app(id),
  deal_id       uuid,           -- FK added in Phase 4 (Fibre Sales)
  type          text not null,
  subject       text not null check (length(subject) <= 200),
  occurred_at   timestamptz not null default now(),
  created_by    uuid references public."user"(id)
);
create index activity_person_idx    on public.activity (person_id, occurred_at desc);
create index activity_workspace_idx on public.activity (workspace_id, occurred_at desc);
create index activity_app_idx       on public.activity (app_id, occurred_at desc);

-- Enforce append-only at the DB layer.
create or replace function public.activity_is_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'activity is append-only — write a correction row instead';
end;
$$;
create trigger activity_no_update before update on public.activity
  for each row execute function public.activity_is_append_only();
create trigger activity_no_delete before delete on public.activity
  for each row execute function public.activity_is_append_only();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.program   enable row level security;
alter table public.enrolment enable row level security;
alter table public.activity  enable row level security;

create policy program_workspace on public.program
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy enrolment_via_program on public.enrolment
  for all
  using (exists (select 1 from public.program p where p.id = enrolment.program_id and p.workspace_id = public.current_workspace_id()))
  with check (exists (select 1 from public.program p where p.id = enrolment.program_id and p.workspace_id = public.current_workspace_id()));

create policy activity_workspace_select on public.activity
  for select using (workspace_id = public.current_workspace_id());
create policy activity_workspace_insert on public.activity
  for insert with check (workspace_id = public.current_workspace_id());
-- No update/delete policies: append-only.
