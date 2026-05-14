-- ============================================================================
-- v0.4 — "the app justifies the field"
--
-- Each curator-data table now declares the owning app via app_id FK.
-- Existing rows are backfilled with sensible defaults so nothing is orphaned.
-- Schema is additive and reversible — no existing column is dropped.
-- ============================================================================

-- person_professional → fibre-platform (general professional info, until/unless
-- a dedicated "Fibre People" app takes ownership).
alter table public.person_professional
  add column app_id uuid references public.app(id);
update public.person_professional set app_id = (select id from public.app where slug = 'fibre-platform')
  where app_id is null;
alter table public.person_professional alter column app_id set not null;

-- person_relationship_context → fibre-sales (relationship strength, communication
-- preference, ambassador flag — sales/account-relationship semantics).
alter table public.person_relationship_context
  add column app_id uuid references public.app(id);
update public.person_relationship_context set app_id = (select id from public.app where slug = 'fibre-sales')
  where app_id is null;
alter table public.person_relationship_context alter column app_id set not null;

-- person_change_context → fibre-suite (facilitation context, change role).
alter table public.person_change_context
  add column app_id uuid references public.app(id);
update public.person_change_context set app_id = (select id from public.app where slug = 'fibre-suite')
  where app_id is null;
alter table public.person_change_context alter column app_id set not null;

-- person_learning → fibre-learn.
alter table public.person_learning
  add column app_id uuid references public.app(id);
update public.person_learning set app_id = (select id from public.app where slug = 'fibre-learn')
  where app_id is null;
alter table public.person_learning alter column app_id set not null;

-- org_identity → fibre-platform.
alter table public.org_identity
  add column app_id uuid references public.app(id);
update public.org_identity set app_id = (select id from public.app where slug = 'fibre-platform')
  where app_id is null;
alter table public.org_identity alter column app_id set not null;

-- org_system_context → fibre-suite.
alter table public.org_system_context
  add column app_id uuid references public.app(id);
update public.org_system_context set app_id = (select id from public.app where slug = 'fibre-suite')
  where app_id is null;
alter table public.org_system_context alter column app_id set not null;

-- org_relationship → fibre-sales.
alter table public.org_relationship
  add column app_id uuid references public.app(id);
update public.org_relationship set app_id = (select id from public.app where slug = 'fibre-sales')
  where app_id is null;
alter table public.org_relationship alter column app_id set not null;

-- Indexes — speeds up "does this person/org have a profile row for app X?"
create index if not exists person_professional_app_idx          on public.person_professional (person_id, app_id);
create index if not exists person_relationship_context_app_idx  on public.person_relationship_context (person_id, app_id);
create index if not exists person_change_context_app_idx        on public.person_change_context (person_id, app_id);
create index if not exists person_learning_app_idx              on public.person_learning (person_id, app_id);
create index if not exists org_identity_app_idx                 on public.org_identity (org_id, app_id);
create index if not exists org_system_context_app_idx           on public.org_system_context (org_id, app_id);
create index if not exists org_relationship_app_idx             on public.org_relationship (org_id, app_id);
