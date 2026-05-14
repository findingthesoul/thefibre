-- ============================================================================
-- v0.4.7 — physical address + fibre-sales billing curator tables
--
-- Adds street/postal_code to person and organisation (platform-justified:
-- "where this entity is"), and introduces person_billing/org_billing curator
-- tables owned by fibre-sales. RLS gates these by app_membership so users
-- without sales access never see them.
-- ============================================================================

-- Physical address on platform rows --------------------------------------------
alter table public.person
  add column if not exists street       text,
  add column if not exists postal_code  text;

alter table public.organisation
  add column if not exists street       text,
  add column if not exists postal_code  text;

-- Billing curator tables -------------------------------------------------------
create table if not exists public.org_billing (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null unique references public.organisation(id) on delete cascade,
  app_id               uuid not null references public.app(id),
  legal_name           text,            -- if different from organisation.name
  tax_id               text,            -- VAT / EIN / other tax identifier
  billing_email        citext,
  billing_street       text,
  billing_postal_code  text,
  billing_city         text,
  billing_region       text,
  billing_country      char(2),
  payment_terms_days   integer,
  currency             char(3),
  po_required          boolean,
  notes                text,
  updated_at           timestamptz not null default now()
);
create index if not exists org_billing_app_idx on public.org_billing (org_id, app_id);

create table if not exists public.person_billing (
  id                   uuid primary key default gen_random_uuid(),
  person_id            uuid not null unique references public.person(id) on delete cascade,
  app_id               uuid not null references public.app(id),
  legal_name           text,
  tax_id               text,
  billing_email        citext,
  billing_street       text,
  billing_postal_code  text,
  billing_city         text,
  billing_region       text,
  billing_country      char(2),
  payment_terms_days   integer,
  currency             char(3),
  po_required          boolean,
  notes                text,
  updated_at           timestamptz not null default now()
);
create index if not exists person_billing_app_idx on public.person_billing (person_id, app_id);

-- RLS — same pattern as org_relationship / person_relationship_context --------
alter table public.org_billing    enable row level security;
alter table public.person_billing enable row level security;

drop policy if exists org_billing_app_gated on public.org_billing;
create policy org_billing_app_gated on public.org_billing
  for all
  using (
    exists (select 1 from public.organisation o where o.id = org_billing.org_id and o.workspace_id = public.current_workspace_id())
    and public.has_app_id(org_billing.app_id)
  )
  with check (
    exists (select 1 from public.organisation o where o.id = org_billing.org_id and o.workspace_id = public.current_workspace_id())
    and public.has_app_id(org_billing.app_id)
  );

drop policy if exists person_billing_app_gated on public.person_billing;
create policy person_billing_app_gated on public.person_billing
  for all
  using (
    exists (select 1 from public.person p where p.id = person_billing.person_id and p.workspace_id = public.current_workspace_id())
    and public.has_app_id(person_billing.app_id)
  )
  with check (
    exists (select 1 from public.person p where p.id = person_billing.person_id and p.workspace_id = public.current_workspace_id())
    and public.has_app_id(person_billing.app_id)
  );
