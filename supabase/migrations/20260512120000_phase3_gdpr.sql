-- ============================================================================
-- Phase 3 — GDPR: consent, data subject requests, retention, processing purposes
-- See: docs/fibre-technical-brief-v0.3.md §5 Domain 8 + §10
-- ============================================================================

create table public.consent_record (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public."user"(id),
  person_id     uuid not null references public.person(id) on delete cascade,
  purpose_code  text not null check (purpose_code in (
    'transactional_email',
    'marketing_email',
    'learning_analytics',
    'cohort_directory',
    'facilitation_data',
    'sales_contact'
  )),
  legal_basis   text not null check (legal_basis in (
    'consent','legitimate_interest','contract','legal_obligation'
  )),
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  text_version  text,
  ip_address    inet
);
create index consent_person_purpose_idx on public.consent_record (person_id, purpose_code);
-- Latest grant per (person, purpose) is the active one.
create index consent_active_idx on public.consent_record (person_id, purpose_code, granted_at desc)
  where revoked_at is null;

create table public.data_subject_request (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references public.person(id),
  type          text not null check (type in ('access','erasure','portability','rectification','restriction')),
  status        text not null default 'received'
                check (status in ('received','in_progress','completed','rejected')),
  requested_at  timestamptz not null default now(),
  due_at        timestamptz not null default (now() + interval '30 days'),
  completed_at  timestamptz,
  notes         text
);
create index dsr_status_idx on public.data_subject_request (status, due_at);

create table public.retention_policy (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id),
  data_category   text not null check (data_category in (
    'contact_data','activity_log','facilitation_data','sales_data','learning_data'
  )),
  retention_days  integer not null check (retention_days > 0),
  legal_basis     text not null,
  reviewed_at     date,
  unique (workspace_id, data_category)
);

create table public.processing_purpose (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id),
  purpose_code    text not null,
  description     text not null,
  legal_basis     text not null,
  data_categories text[] not null default '{}',
  third_parties   text[] not null default '{}',
  created_at      timestamptz not null default now(),
  unique (workspace_id, purpose_code)
);

-- ---------------------------------------------------------------------------
-- Helper: check active consent
-- ---------------------------------------------------------------------------
create or replace function public.has_active_consent(p_person_id uuid, p_purpose text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.consent_record
     where person_id = p_person_id
       and purpose_code = p_purpose
       and revoked_at is null
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.consent_record       enable row level security;
alter table public.data_subject_request enable row level security;
alter table public.retention_policy     enable row level security;
alter table public.processing_purpose   enable row level security;

create policy consent_via_person on public.consent_record
  for all
  using (exists (select 1 from public.person p where p.id = consent_record.person_id and p.workspace_id = public.current_workspace_id()))
  with check (exists (select 1 from public.person p where p.id = consent_record.person_id and p.workspace_id = public.current_workspace_id()));

create policy dsr_via_person on public.data_subject_request
  for all
  using (exists (select 1 from public.person p where p.id = data_subject_request.person_id and p.workspace_id = public.current_workspace_id()))
  with check (exists (select 1 from public.person p where p.id = data_subject_request.person_id and p.workspace_id = public.current_workspace_id()));

create policy retention_workspace on public.retention_policy
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy processing_workspace on public.processing_purpose
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());
