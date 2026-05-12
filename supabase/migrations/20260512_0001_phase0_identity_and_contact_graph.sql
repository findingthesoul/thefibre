-- ============================================================================
-- The Fibre — Phase 0 migration
-- Identity, multi-tenancy, contact graph, RLS skeleton.
-- See: docs/fibre-technical-brief-v0.3.md §5
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- JWT helpers (workspace claim from Supabase Auth)
-- ---------------------------------------------------------------------------
create or replace function public.current_workspace_id()
returns uuid
language sql
stable
as $$
  select nullif(((current_setting('request.jwt.claims', true))::jsonb ->> 'workspace_id'), '')::uuid
$$;

create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(((current_setting('request.jwt.claims', true))::jsonb ->> 'sub'), '')::uuid
$$;

create or replace function public.has_app_membership(p_app_slug text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
      from public.app_membership am
      join public.app a on a.id = am.app_id
     where am.user_id = public.current_user_id()
       and a.slug = p_app_slug
  )
$$;

-- ---------------------------------------------------------------------------
-- Domain 1: identity and tenancy
-- ---------------------------------------------------------------------------
create table public.workspace (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  plan        text not null default 'free'
                check (plan in ('free','starter','pro','enterprise')),
  created_at  timestamptz not null default now()
);

create table public.app (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null unique
              check (slug in ('fibre-suite','the-thread','fibre-sales','fibre-learn')),
  name      text not null,
  base_url  text
);

insert into public.app (slug, name, base_url) values
  ('fibre-suite', 'Fibre Suite', 'https://suite.thefibre.app'),
  ('the-thread',  'The Thread',  'https://thread.thefibre.app'),
  ('fibre-sales', 'Fibre Sales', 'https://sales.thefibre.app'),
  ('fibre-learn', 'Fibre Learn', 'https://learn.thefibre.app');

create table public."user" (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspace(id),
  person_id            uuid,        -- FK added after person table created
  email                citext not null,
  full_name            text,
  avatar_url           text,
  primary_auth_method  text check (primary_auth_method in ('google','magic_link','microsoft','linkedin')),
  email_verified       boolean not null default false,
  last_sign_in         timestamptz,
  created_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  unique (workspace_id, email)
);
create index user_workspace_idx on public."user" (workspace_id) where deleted_at is null;

create table public.user_identity_provider (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public."user"(id) on delete cascade,
  provider              text not null check (provider in ('google','microsoft','linkedin','magic_link')),
  provider_user_id      text not null,
  provider_email        citext,
  provider_name         text,
  provider_avatar_url   text,
  provider_metadata     jsonb not null default '{}'::jsonb,
  access_token_hint     text,
  is_primary            boolean not null default false,
  connected_at          timestamptz not null default now(),
  last_used_at          timestamptz,
  unique (provider, provider_user_id)
);

create table public.sso_match_log (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public."user"(id),
  person_id      uuid,
  provider       text not null,
  match_method   text not null check (match_method in ('provider_id','email','created_new')),
  resolution     text not null check (resolution in ('matched','linked','created')),
  notes          text,
  occurred_at    timestamptz not null default now()
);

create table public.app_membership (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public."user"(id) on delete cascade,
  app_id       uuid not null references public.app(id),
  role         text not null,
  permissions  jsonb not null default '{}'::jsonb,
  granted_at   timestamptz not null default now(),
  unique (user_id, app_id)
);

create table public.session (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public."user"(id) on delete cascade,
  token_hash  text not null,
  expires_at  timestamptz not null,
  ip_address  inet,
  user_agent  text
);

-- ---------------------------------------------------------------------------
-- Domain 2: contact graph — person
-- ---------------------------------------------------------------------------
create table public.person (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public."user"(id),
  workspace_id        uuid not null references public.workspace(id),
  first_name          text,
  last_name           text,
  preferred_name      text,
  pronouns            text,
  email               citext,
  email_secondary     citext,
  phone               text,
  phone_secondary     text,
  linkedin_url        text,
  website_url         text,
  city                text,
  region              text,
  country             char(2),
  preferred_language  text,
  languages_spoken    text[] not null default '{}',
  custom_fields       jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index person_workspace_idx on public.person (workspace_id) where deleted_at is null;
create index person_email_idx     on public.person (workspace_id, email) where deleted_at is null;

alter table public."user"
  add constraint user_person_fk foreign key (person_id) references public.person(id);

create table public.person_professional (
  id                    uuid primary key default gen_random_uuid(),
  person_id             uuid not null unique references public.person(id) on delete cascade,
  current_title         text,
  current_department    text,
  seniority_level       text check (seniority_level in ('junior','mid','senior','lead','executive','board')),
  sector                text,
  expertise_areas       text[] not null default '{}',
  industries_worked_in  text[] not null default '{}',
  years_of_experience   integer,
  career_stage          text check (career_stage in ('early','established','senior','transitioning','portfolio')),
  is_independent        boolean,
  certifications        text[] not null default '{}',
  spoken_at_events      text[] not null default '{}',
  updated_at            timestamptz not null default now()
);

create table public.person_relationship_context (
  id                        uuid primary key default gen_random_uuid(),
  person_id                 uuid not null unique references public.person(id) on delete cascade,
  source                    text check (source in ('event_attendee','referral','cold_outreach','client_contact','inbound')),
  source_detail             text,
  introduced_by             uuid references public.person(id),
  relationship_strength     text check (relationship_strength in ('weak','warm','strong','advocate')),
  communication_preference  text check (communication_preference in ('email','phone','linkedin','in_person')),
  best_time_to_reach        text,
  is_key_contact            boolean not null default false,
  is_ambassador             boolean not null default false,
  first_contact_notes       text,
  first_contact_at          timestamptz,
  primary_owner             uuid references public."user"(id),
  updated_at                timestamptz not null default now()
);

create table public.person_change_context (
  id                  uuid primary key default gen_random_uuid(),
  person_id           uuid not null unique references public.person(id) on delete cascade,
  role_in_change      text check (role_in_change in ('sponsor','champion','implementer','sceptic','bystander','gatekeeper')),
  stance_on_change    text check (stance_on_change in ('driving','supporting','ambivalent','resistant')),
  change_themes       text[] not null default '{}',
  leadership_style    text,
  blockers            text[] not null default '{}',
  motivators          text[] not null default '{}',
  current_challenge   text,
  facilitator_notes   text,           -- sensitive, see §5.D2
  readiness_level     text check (readiness_level in ('not_ready','cautious','open','ready','driving')),
  notes_updated_at    timestamptz,
  notes_updated_by    uuid references public."user"(id)
);

create table public.person_learning (
  id                        uuid primary key default gen_random_uuid(),
  person_id                 uuid not null unique references public.person(id) on delete cascade,
  learning_interests        text[] not null default '{}',
  prior_programmes          text[] not null default '{}',
  learning_style            text check (learning_style in ('visual','auditory','reading','kinaesthetic','reflective')),
  group_role_tendency       text check (group_role_tendency in ('connector','challenger','synthesiser','anchor','observer')),
  development_goals         text,
  post_programme_reflection text,
  open_to_coaching          boolean,
  open_to_peer_exchange     boolean,
  updated_at                timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Domain 3: contact graph — organisation
-- ---------------------------------------------------------------------------
create table public.organisation (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspace(id),
  parent_org_id       uuid references public.organisation(id),
  name                text not null,
  legal_name          text,
  short_name          text,
  domain              text,
  website             text,
  linkedin_url        text,
  vat_number          text,
  registration_number text,
  city                text,
  region              text,
  country             char(2),
  operating_countries text[] not null default '{}',
  size_band           text check (size_band in ('1-10','11-50','51-200','201-1000','1000+')),
  sector              text,
  industry            text,
  org_type            text check (org_type in ('private','public','ngo','cooperative','government','education')),
  logo_url            text,
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index org_workspace_idx on public.organisation (workspace_id) where deleted_at is null;
create index org_domain_idx    on public.organisation (workspace_id, domain) where deleted_at is null;

create table public.org_identity (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null unique references public.organisation(id) on delete cascade,
  mission_statement       text,
  vision_statement        text,
  stated_values           text[] not null default '{}',
  cultural_descriptors    text[] not null default '{}',
  governance_model        text check (governance_model in ('hierarchical','flat','matrix','holacracy','cooperative')),
  ownership_type          text check (ownership_type in ('private','public','family','employee','state','ngo')),
  decision_making_style   text check (decision_making_style in ('top_down','consultative','consensus','delegated')),
  languages_of_operation  text[] not null default '{}',
  maturity_stage          text check (maturity_stage in ('startup','growth','established','legacy','transitioning')),
  identity_notes          text,
  updated_at              timestamptz not null default now()
);

create table public.org_system_context (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid not null unique references public.organisation(id) on delete cascade,
  transformation_stage        text check (transformation_stage in ('pre_awareness','exploring','committed','in_programme','sustaining','alumni')),
  active_change_themes        text[] not null default '{}',
  structural_tensions         text[] not null default '{}',
  strategic_priorities        text,
  current_challenges          text,
  political_landscape         text,       -- sensitive
  leadership_stability        text check (leadership_stability in ('stable','transitioning','turbulent')),
  change_readiness            text check (change_readiness in ('not_ready','cautious','open','ready','driving')),
  previous_interventions      text[] not null default '{}',
  lessons_from_previous_work  text,
  blockers                    text[] not null default '{}',
  enablers                    text[] not null default '{}',
  notes_updated_at            timestamptz,
  notes_updated_by            uuid references public."user"(id)
);

create table public.org_relationship (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null unique references public.organisation(id) on delete cascade,
  primary_owner             uuid references public."user"(id),
  secondary_owner           uuid references public."user"(id),
  relationship_stage        text check (relationship_stage in ('prospect','engaged','active_client','alumni','dormant','lost')),
  health_status             text check (health_status in ('active','at_risk','dormant','lost','never_converted')),
  engagement_type           text check (engagement_type in ('facilitation','learning','advisory','speaking','mixed')),
  programmes_completed      text[] not null default '{}',
  total_participants_reached integer not null default 0,
  touchpoints_count         integer not null default 0,
  relationship_history      text,
  next_opportunity          text,
  last_touchpoint_at        date,
  next_planned_contact      date,
  updated_at                timestamptz not null default now()
);

create table public.org_membership (
  id                uuid primary key default gen_random_uuid(),
  person_id         uuid not null references public.person(id) on delete cascade,
  org_id            uuid not null references public.organisation(id) on delete cascade,
  title             text,
  department        text,
  sub_department    text,
  seniority_level   text,
  employment_type   text check (employment_type in ('permanent','interim','consultant','board','volunteer')),
  role_in_change    text check (role_in_change in ('sponsor','champion','implementer','sceptic','bystander','gatekeeper')),
  influence_level   text check (influence_level in ('formal','informal','both')),
  is_primary        boolean not null default false,
  is_decision_maker boolean not null default false,
  is_budget_holder  boolean not null default false,
  is_champion       boolean not null default false,
  started_at        date,
  ended_at          date
);
create index org_membership_current_idx on public.org_membership (org_id) where ended_at is null;
create index org_membership_person_idx  on public.org_membership (person_id) where ended_at is null;

-- ---------------------------------------------------------------------------
-- Domain 4: relationships and tags
-- ---------------------------------------------------------------------------
create table public.relationship (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id),
  from_person_id  uuid not null references public.person(id) on delete cascade,
  to_person_id    uuid not null references public.person(id) on delete cascade,
  type            text not null check (type in ('introduced_by','co_facilitates','referred','colleague','peer','mentor')),
  strength        text check (strength in ('weak','warm','strong','advocate')),
  notes           text,
  created_at      timestamptz not null default now(),
  check (from_person_id <> to_person_id)
);

create table public.tag (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspace(id),
  name          text not null,
  color         text,
  unique (workspace_id, name)
);

create table public.person_tag (
  person_id   uuid not null references public.person(id) on delete cascade,
  tag_id      uuid not null references public.tag(id) on delete cascade,
  primary key (person_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- RLS — Phase 0 baseline
-- Pattern: workspace_id = current_workspace_id()
-- Soft-deleted rows are filtered at application layer (and ideally a view).
-- ---------------------------------------------------------------------------
alter table public.workspace                    enable row level security;
alter table public."user"                       enable row level security;
alter table public.user_identity_provider       enable row level security;
alter table public.sso_match_log                enable row level security;
alter table public.app_membership               enable row level security;
alter table public.session                      enable row level security;
alter table public.person                       enable row level security;
alter table public.person_professional          enable row level security;
alter table public.person_relationship_context  enable row level security;
alter table public.person_change_context        enable row level security;
alter table public.person_learning              enable row level security;
alter table public.organisation                 enable row level security;
alter table public.org_identity                 enable row level security;
alter table public.org_system_context           enable row level security;
alter table public.org_relationship             enable row level security;
alter table public.org_membership               enable row level security;
alter table public.relationship                 enable row level security;
alter table public.tag                          enable row level security;
alter table public.person_tag                   enable row level security;

-- Workspace: a user sees only their own workspace.
create policy workspace_self on public.workspace
  for select using (id = public.current_workspace_id());

-- User table: workspace-scoped.
create policy user_workspace on public."user"
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy uip_owner on public.user_identity_provider
  for all using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy ssomatch_self on public.sso_match_log
  for select using (user_id = public.current_user_id());

create policy app_membership_self on public.app_membership
  for select using (user_id = public.current_user_id());

create policy session_self on public.session
  for all using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

-- Person + profiles: workspace-scoped via parent person.workspace_id.
create policy person_workspace on public.person
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy person_prof_via_parent on public.person_professional
  for all
  using (exists (select 1 from public.person p where p.id = person_professional.person_id and p.workspace_id = public.current_workspace_id()))
  with check (exists (select 1 from public.person p where p.id = person_professional.person_id and p.workspace_id = public.current_workspace_id()));

create policy person_relctx_via_parent on public.person_relationship_context
  for all
  using (exists (select 1 from public.person p where p.id = person_relationship_context.person_id and p.workspace_id = public.current_workspace_id()))
  with check (exists (select 1 from public.person p where p.id = person_relationship_context.person_id and p.workspace_id = public.current_workspace_id()));

create policy person_change_via_parent on public.person_change_context
  for all
  using (exists (select 1 from public.person p where p.id = person_change_context.person_id and p.workspace_id = public.current_workspace_id()))
  with check (exists (select 1 from public.person p where p.id = person_change_context.person_id and p.workspace_id = public.current_workspace_id()));

create policy person_learning_via_parent on public.person_learning
  for all
  using (exists (select 1 from public.person p where p.id = person_learning.person_id and p.workspace_id = public.current_workspace_id()))
  with check (exists (select 1 from public.person p where p.id = person_learning.person_id and p.workspace_id = public.current_workspace_id()));

-- Organisation + profiles
create policy org_workspace on public.organisation
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy org_identity_via_parent on public.org_identity
  for all
  using (exists (select 1 from public.organisation o where o.id = org_identity.org_id and o.workspace_id = public.current_workspace_id()))
  with check (exists (select 1 from public.organisation o where o.id = org_identity.org_id and o.workspace_id = public.current_workspace_id()));

create policy org_sysctx_via_parent on public.org_system_context
  for all
  using (exists (select 1 from public.organisation o where o.id = org_system_context.org_id and o.workspace_id = public.current_workspace_id()))
  with check (exists (select 1 from public.organisation o where o.id = org_system_context.org_id and o.workspace_id = public.current_workspace_id()));

create policy org_rel_via_parent on public.org_relationship
  for all
  using (exists (select 1 from public.organisation o where o.id = org_relationship.org_id and o.workspace_id = public.current_workspace_id()))
  with check (exists (select 1 from public.organisation o where o.id = org_relationship.org_id and o.workspace_id = public.current_workspace_id()));

create policy org_member_via_parent on public.org_membership
  for all
  using (exists (select 1 from public.organisation o where o.id = org_membership.org_id and o.workspace_id = public.current_workspace_id()))
  with check (exists (select 1 from public.organisation o where o.id = org_membership.org_id and o.workspace_id = public.current_workspace_id()));

create policy relationship_workspace on public.relationship
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy tag_workspace on public.tag
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy person_tag_via_parent on public.person_tag
  for all
  using (exists (select 1 from public.person p where p.id = person_tag.person_id and p.workspace_id = public.current_workspace_id()))
  with check (exists (select 1 from public.person p where p.id = person_tag.person_id and p.workspace_id = public.current_workspace_id()));

-- NOTE: app-scoped tables (Fibre Sales) get a second RLS condition in Phase 4:
--   AND public.has_app_membership('fibre-sales')
