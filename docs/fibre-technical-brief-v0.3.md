# The Fibre — Technical Briefing
**Version:** 0.3
**Owner:** Sjoerd / Soul.com / One Soul Community Coöperatief U.A.
**Domain:** thefibre.app
**Purpose:** Reference document for Claude Code implementation
**Changes from v0.2:** Platform renamed to The Fibre (thefibre.app); product vision statement added; contact + activity intelligence named as core value proposition; app family renamed to Fibre Suite, The Thread, Fibre Sales, Fibre Learn.

---

## 1. What this is

### Product vision

Most CRMs store what happened. A call was made. A deal was won. A session was attended. The record is transactional — a log of touches with no connective tissue.

The Fibre is different. A contact record in The Fibre is a living portrait of a person in the context of purpose-driven work. Their role in transformation. Their blockers and motivators. Their learning history. The meetings they attended, the journeys they walked, the moments that shifted something. The facilitator's observation from three years ago sitting alongside last week's session attendance and the open deal with their employer.

The timeline is the product. Not the pipeline. Not the programme. The accumulated record of every meaningful interaction — across every app, across every context, across time — held in one place, governed by European standards, owned by a cooperative.

The Fibre holds The Thread. That sentence is true in both directions.

### What the platform is

The Fibre is a multi-tenant identity, contact, and relationship foundation for a family of purpose-driven applications. It is not a standalone product. It is infrastructure — the layer that apps are built on top of, and the intelligence layer that makes every app more useful than it would be alone.

The platform provides:

- Single Sign-On (SSO) across all apps — Google OAuth live, Microsoft and LinkedIn planned
- A unified contact graph (persons, organisations, relationships) — rich, not minimum
- A shared activity event log — the accumulated record of every meaningful interaction across all apps
- App-level user roles and permissions per app
- Programme and enrolment management — shared schema, app-specific content
- GDPR-native data architecture, built for European standards from day one
- A public landing platform at thefibre.app routing visitors to their app

The platform does not store app-specific content. What happens inside an app stays inside that app. Only events cross the wall. But those events, accumulated over time across all apps, are the intelligence that makes a contact record worth opening.

---

## 2. Application family

| App | Slug | Domain | Description | Format values | Status |
|-----|------|--------|-------------|---------------|--------|
| Fibre Suite | `fibre-suite` | suite.thefibre.app | Meeting platform — agenda, facilitation, outcomes | `meeting` | Active |
| The Thread | `the-thread` | thread.thefibre.app | Event and journey platform — conferences, personal arcs | `event`, `journey` | Active |
| Fibre Sales | `fibre-sales` | sales.thefibre.app | Sales pipeline and account management — sovereign, gated | n/a | To be built |
| Fibre Learn | `fibre-learn` | learn.thefibre.app | Self-paced content platform — modules, assessments | `self_paced`, `blended` | Future |
| Partner apps | varies | varies | Third-party apps built on The Fibre API | varies | Future |

Every app authenticates through the same identity layer. One login, all apps. What differs per app: roles, permissions, and the content that lives inside the app's own schema.

### The data wall

This is the governing architectural principle. State it once, enforce it everywhere.

The person travels. The experience stays. Only events cross the wall.

- The platform holds: identity, contact graph, enrolment state, activity events
- Each app holds: its own content, notes, responses, scores, outcomes, media
- No app reads another app's content data — ever
- The activity log records that something happened — not what was said, scored, or reflected

---

## 3. App identities

### Fibre Suite — meeting platform

Fibre Suite's unit of work is the meeting. A meeting has a before (agenda design), a during (live facilitation), and an after (outcomes, decisions, action items). The facilitator is the host. The room is the instrument.

Fibre Suite owns internally: agenda items and structure, meeting outcomes and decisions, action items with owners and due dates, facilitator observations, participant contribution notes, exercise responses (sensitive — never leaves Fibre Suite), room logistics.

Fibre Suite writes to the platform: `meeting_attended`, `meeting_facilitated`, `action_item_assigned`, `programme_completed` — type and subject only, no body content.

### The Thread — event and journey platform

The Thread holds two distinct modes:

An event is a public or semi-public happening with open or managed registration — a conference, symposium, or workshop. It has a schedule, sessions, speakers, tracks, and registered attendees who move through it. EBBF Athens is an event on The Thread.

A journey is a personal arc — someone moving through a designed sequence of experiences over time, at their own pace, with milestones, reflections, and resources. Progress is individual. There is no cohort moving together unless the journey is explicitly cohort-shaped.

The Thread owns internally: session schedule and selections (event), personal reflections and journey responses (journey), milestone completion data, peer connections made, event materials accessed, cohort directory.

The Thread writes to the platform: `event_registered`, `session_attended`, `journey_step_completed`, `programme_completed` — type and subject only, no reflection content.

### Fibre Sales — sovereign app

Fibre Sales is gated behind its own `app_membership`. A facilitator in Fibre Suite has no access to it. A participant in The Thread has no access to it. The roles do not overlap by design.

Fibre Sales owns exclusively: deals and pipeline stages, deal contacts and roles, line items and proposals, revenue data, sales notes (full body, never exposed to platform activity log), forecasting data, touchpoint history.

Fibre Sales reads from the platform: person and organisation profiles, org relationship context, activity event timeline (events only — to understand engagement).

Fibre Sales writes to the platform: `deal_won` event (triggers programme creation handover), lightweight sales touch events (`call_made`, `proposal_sent`) — subject only.

The deal.won event is the seam between sales and delivery. It triggers a platform webhook that creates a programme in the appropriate delivery app. Below it is sales territory. Above it is delivery territory.

### Fibre Learn — future app

Not built yet. Architecture reserved. When built, Fibre Learn is a self-paced content platform with modules, lessons, content blocks, assessments, and granular learner progress tracking. It plugs into the same identity, contact, and enrolment layer as all other apps.

Fibre Learn owns internally: module and lesson content, video watch position, assessment questions and answers, quiz attempt history, scores per lesson, certificates.

Fibre Learn writes to the platform: `lesson_completed`, `module_completed`, `programme_completed`, `assessment_passed` — type and subject only.

---

## 4. Technology choices

### Guiding constraints

- EU data residency is mandatory. All infrastructure hosted in the EU. No data transits or is stored outside EU jurisdiction.
- GDPR is architecture, not compliance. Consent, retention, subject rights, and purpose limitation are modelled in the schema and enforced at the application layer.
- Build on primitives, own the integration layer. The advantage lives in how services are assembled, not in reinventing each one.
- Do not solve problems you do not have. Start with the lowest operational overhead that meets the requirements. Migrate when a specific constraint forces the move.

### Infrastructure decisions

**Database and auth: Supabase managed, Frankfurt region**

The entire multi-tenant architecture is built on PostgreSQL Row-Level Security. Supabase's JWT-to-RLS integration is the cleanest available implementation of this pattern — it is the reason the data model works the way it does. Rebuilding that integration with any alternative would cost weeks and introduce coupling risk that is not justified at this stage.

Supabase is a US-incorporated company. Even on the Frankfurt region, the CLOUD Act applies as a legal surface. This is a known and documented limitation. It is mitigated in two ways: (1) the architecture keeps personal data out of Vercel entirely — Supabase is the only place personal data rests; (2) Supabase is open-source, and the migration path to self-hosted Supabase on Hetzner is a connection string change and a Docker Compose file, not a rewrite. If a client or regulatory situation demands full sovereignty, that migration is executed. It is not designed for speculatively on day one.

Supabase must be documented as a data processor in the `processing_purpose` table with legal basis and SCCs noted.

**Frontend: Vercel, EU region configured**

Vercel is correct for the frontend layer under one hard condition: no personal data is processed in Vercel. Vercel states explicitly that no data is stored permanently in EU regions — static assets and function responses are cached ephemerally. IP addresses pass through US infrastructure for DDoS protection regardless of region setting. This is acceptable only because the frontend is stateless: it receives a JWT, calls the EU API, renders the response. It stores nothing and processes nothing.

If personal data were processed in Next.js API routes or Edge Functions, the clean GDPR story would break. See implementation rule 13.

**Backend API: Fly.io Frankfurt or Railway EU**

All personal data processing happens here — queries, RLS enforcement, consent checking, email dispatch. This layer must run in EU jurisdiction under an EU-incorporated or EU-data-resident provider. Fly.io (Frankfurt machines) and Railway (EU region) are both viable. Both deploy Docker containers. Fly.io gives more infrastructure control; Railway is simpler to operate. Decide based on team preference before Phase 0.

**Migration trigger: when to move to self-hosted Supabase**

If any of these occur, migrate to self-hosted Supabase on Hetzner bare metal or OVHcloud:

- A client contractually requires EU-incorporated data processor with no US parent
- Supabase pricing becomes material at scale (evaluate at 10,000+ active users)
- A regulatory requirement (health sector, public sector procurement) demands full data sovereignty

The migration is low-risk because Supabase is standard Postgres. Schema, RLS policies, and Auth configuration migrate directly.

### Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Database | PostgreSQL via Supabase (Frankfurt) | RLS + auth integration; open-source migration path |
| Auth | Supabase Auth | Magic link, Google OAuth live; Microsoft and LinkedIn via same pattern |
| Backend API | Node.js + Fastify or Hono | TypeScript-native, EU-deployed on Fly.io or Railway |
| Frontend | Next.js (App Router) on Vercel | Stateless only — no personal data processed here |
| Styling | Tailwind CSS | Utility-first, consistent design tokens |
| Email | Resend | EU-compatible, consent-gated at dispatch layer |
| File storage | Supabase Storage (Frankfurt) | EU-resident, S3-compatible |
| Billing | Stripe | Thin abstraction layer; document as processor |
| Search | PostgreSQL full-text search initially | Avoid external processors unless necessary |
| Connection pooling | Supabase PgBouncer (transaction mode) | Required from day one — not retrofitted |

**Evaluated and not chosen:**

Appwrite (self-hosted) — uses MariaDB, no RLS support. Wrong database for this architecture.

Nhost managed — Swedish-incorporated, Postgres + Hasura. Viable if GraphQL is preferred or if EU incorporation becomes a contractual requirement. Migration cost: PostgREST to Hasura GraphQL layer.

Neon + Clerk — splits database and auth into two separate services. The JWT-to-RLS integration requires manual plumbing that Supabase provides natively. Revisit only if Supabase Auth becomes a bottleneck.

Self-hosted Supabase on Hetzner — full sovereignty, low hosting cost (~€20/mo). Operational overhead is real: Docker Compose maintenance, backups, monitoring, updates. Correct destination if sovereignty becomes a hard requirement; premature as a starting point.

---

## 5. Data model

All tables use UUID primary keys. All personal data tables carry `created_at` and `deleted_at` (soft delete — never hard delete personal data). Money always stored as integer cents, never float.

### Domain 1: Identity and tenancy

```sql
workspace
  id            uuid PK
  slug          text UNIQUE
  name          text
  plan          text                -- free | starter | pro | enterprise
  created_at    timestamptz

user
  id            uuid PK
  workspace_id  uuid FK → workspace
  person_id     uuid FK → person    -- nullable until person record exists
  email         text
  full_name     text
  avatar_url    text
  primary_auth_method text          -- google | magic_link | microsoft | linkedin
  email_verified boolean
  last_sign_in  timestamptz
  created_at    timestamptz
  deleted_at    timestamptz

user_identity_provider
  id                  uuid PK
  user_id             uuid FK → user
  provider            text          -- google | microsoft | linkedin | magic_link
  provider_user_id    text          -- immutable ID from the provider
  provider_email      text          -- may differ from platform email
  provider_name       text
  provider_avatar_url text
  provider_metadata   jsonb         -- hd (hosted domain), locale, etc.
  access_token_hint   text          -- last 4 chars only — never full token
  is_primary          boolean
  connected_at        timestamptz
  last_used_at        timestamptz

sso_match_log
  id            uuid PK
  user_id       uuid FK → user
  person_id     uuid FK → person
  provider      text
  match_method  text                -- provider_id | email | created_new
  resolution    text                -- matched | linked | created
  notes         text
  occurred_at   timestamptz

app
  id            uuid PK
  slug          text UNIQUE         -- fibre-suite | the-thread | fibre-sales | fibre-learn
  name          text
  base_url      text

app_membership
  id            uuid PK
  user_id       uuid FK → user
  app_id        uuid FK → app
  role          text                -- varies per app — see app briefs
  permissions   jsonb
  granted_at    timestamptz

session
  id            uuid PK
  user_id       uuid FK → user
  token_hash    text
  expires_at    timestamptz
  ip_address    inet
  user_agent    text
```

`user_identity_provider` is the multi-provider SSO table. One user can have rows for Google, Microsoft, LinkedIn, and magic link simultaneously. `provider_user_id` is the canonical match key — email is the fallback for first-time linking. Raw OAuth tokens are never stored here; Supabase Auth manages them. The `hd` (hosted domain) claim from Google Workspace can be used to auto-suggest org membership links.

### Domain 2: Contact graph — person

The contact graph is rich by design. Every field must answer a real question a facilitator or business developer will actually ask.

```sql
person
  id                  uuid PK
  user_id             uuid FK → user    -- nullable: contact may not be a platform user
  workspace_id        uuid FK → workspace
  first_name          text
  last_name           text
  preferred_name      text
  pronouns            text
  email               text
  email_secondary     text
  phone               text
  phone_secondary     text
  linkedin_url        text
  website_url         text
  city                text
  region              text
  country             text              -- ISO 3166-1 alpha-2
  preferred_language  text
  languages_spoken    text[]
  custom_fields       jsonb
  created_at          timestamptz
  deleted_at          timestamptz

person_professional
  id                    uuid PK
  person_id             uuid FK → person
  current_title         text
  current_department    text
  seniority_level       text            -- junior | mid | senior | lead | executive | board
  sector                text
  expertise_areas       text[]
  industries_worked_in  text[]
  years_of_experience   integer
  career_stage          text            -- early | established | senior | transitioning | portfolio
  is_independent        boolean
  certifications        text[]
  spoken_at_events      text[]
  updated_at            timestamptz

person_relationship_context
  id                        uuid PK
  person_id                 uuid FK → person
  source                    text        -- event_attendee | referral | cold_outreach | client_contact | inbound
  source_detail             text
  introduced_by             uuid FK → person
  relationship_strength     text        -- weak | warm | strong | advocate
  communication_preference  text        -- email | phone | linkedin | in_person
  best_time_to_reach        text
  is_key_contact            boolean
  is_ambassador             boolean
  first_contact_notes       text
  first_contact_at          timestamptz
  primary_owner             uuid FK → user
  updated_at                timestamptz

person_change_context
  id                  uuid PK
  person_id           uuid FK → person
  role_in_change      text              -- sponsor | champion | implementer | sceptic | bystander | gatekeeper
  stance_on_change    text              -- driving | supporting | ambivalent | resistant
  change_themes       text[]
  leadership_style    text
  blockers            text[]
  motivators          text[]
  current_challenge   text
  facilitator_notes   text              -- sensitive: access-controlled per facilitator
  readiness_level     text              -- not_ready | cautious | open | ready | driving
  notes_updated_at    timestamptz
  notes_updated_by    uuid FK → user

person_learning
  id                        uuid PK
  person_id                 uuid FK → person
  learning_interests        text[]
  prior_programmes          text[]
  learning_style            text        -- visual | auditory | reading | kinaesthetic | reflective
  group_role_tendency       text        -- connector | challenger | synthesiser | anchor | observer
  development_goals         text
  post_programme_reflection text        -- populated after programme ends; participant-owned
  open_to_coaching          boolean
  open_to_peer_exchange     boolean
  updated_at                timestamptz
```

`person_change_context.facilitator_notes` is the most sensitive field in the schema. Access is restricted to the facilitator who wrote it and workspace admins. It never appears in export responses to the subject. It is retained according to `retention_policy` for `facilitation_data`.

`person_learning.post_programme_reflection` is participant-owned. They choose to write it; they can delete it at any time. It does not flow from any app automatically.

### Domain 3: Contact graph — organisation

```sql
organisation
  id                  uuid PK
  workspace_id        uuid FK → workspace
  parent_org_id       uuid FK → organisation  -- self-referential for subsidiaries
  name                text
  legal_name          text
  short_name          text
  domain              text
  website             text
  linkedin_url        text
  vat_number          text
  registration_number text
  city                text
  region              text
  country             text
  operating_countries text[]
  size_band           text        -- 1-10 | 11-50 | 51-200 | 201-1000 | 1000+
  sector              text
  industry            text
  org_type            text        -- private | public | ngo | cooperative | government | education
  logo_url            text
  created_at          timestamptz
  deleted_at          timestamptz

org_identity
  id                      uuid PK
  org_id                  uuid FK → organisation
  mission_statement       text
  vision_statement        text
  stated_values           text[]
  cultural_descriptors    text[]
  governance_model        text    -- hierarchical | flat | matrix | holacracy | cooperative
  ownership_type          text    -- private | public | family | employee | state | ngo
  decision_making_style   text    -- top_down | consultative | consensus | delegated
  languages_of_operation  text[]
  maturity_stage          text    -- startup | growth | established | legacy | transitioning
  identity_notes          text
  updated_at              timestamptz

org_system_context
  id                          uuid PK
  org_id                      uuid FK → organisation
  transformation_stage        text    -- pre_awareness | exploring | committed | in_programme | sustaining | alumni
  active_change_themes        text[]
  structural_tensions         text[]
  strategic_priorities        text
  current_challenges          text
  political_landscape         text    -- sensitive: access-controlled
  leadership_stability        text    -- stable | transitioning | turbulent
  change_readiness            text    -- not_ready | cautious | open | ready | driving
  previous_interventions      text[]
  lessons_from_previous_work  text
  blockers                    text[]
  enablers                    text[]
  notes_updated_at            timestamptz
  notes_updated_by            uuid FK → user

org_relationship
  id                        uuid PK
  org_id                    uuid FK → organisation
  primary_owner             uuid FK → user
  secondary_owner           uuid FK → user
  relationship_stage        text    -- prospect | engaged | active_client | alumni | dormant | lost
  health_status             text    -- active | at_risk | dormant | lost | never_converted
  engagement_type           text    -- facilitation | learning | advisory | speaking | mixed
  programmes_completed      text[]
  total_participants_reached integer
  touchpoints_count         integer
  relationship_history      text
  next_opportunity          text
  last_touchpoint_at        date
  next_planned_contact      date
  updated_at                timestamptz

org_membership
  id                uuid PK
  person_id         uuid FK → person
  org_id            uuid FK → organisation
  title             text
  department        text
  sub_department    text
  seniority_level   text
  employment_type   text    -- permanent | interim | consultant | board | volunteer
  role_in_change    text    -- mirrors person_change_context.role_in_change but per org
  influence_level   text    -- formal | informal | both
  is_primary        boolean
  is_decision_maker boolean
  is_budget_holder  boolean
  is_champion       boolean
  started_at        date
  ended_at          date    -- null = current; set when person leaves
```

`org_system_context.political_landscape` is sensitive. It contains observations about internal power dynamics. Access is restricted to workspace admins and the person who wrote it.

`org_membership.ended_at` is required for correctness. A query for current members always filters `WHERE ended_at IS NULL`. Without this, historical memberships corrupt current views.

`organisation.parent_org_id` enables a full org hierarchy tree. A municipality and its departments, a multinational and its subsidiaries, a cooperative and its members — all modelled with this one self-referential key.

### Domain 4: Relationships and tags

```sql
relationship
  id              uuid PK
  workspace_id    uuid FK → workspace
  from_person_id  uuid FK → person
  to_person_id    uuid FK → person
  type            text        -- introduced_by | co_facilitates | referred | colleague | peer | mentor
  strength        text        -- weak | warm | strong | advocate
  notes           text
  created_at      timestamptz

tag
  id            uuid PK
  workspace_id  uuid FK → workspace
  name          text
  color         text

person_tag
  person_id   uuid FK → person
  tag_id      uuid FK → tag
```

### Domain 5: Programme and enrolment

The `program` table is shared across all apps. The `format` field determines which app created it and what content structure lives inside the app.

```sql
program
  id            uuid PK
  workspace_id  uuid FK → workspace
  app_id        uuid FK → app
  title         text
  format        text          -- meeting | event | journey | self_paced | blended
  status        text          -- draft | active | completed | archived
  starts_on     date
  ends_on       date
  created_at    timestamptz

enrolment
  id                uuid PK
  program_id        uuid FK → program
  person_id         uuid FK → person
  status            text      -- invited | enrolled | active | completed | dropped
  progress_pct      integer
  current_lesson_id uuid      -- nullable; used by Fibre Learn for resume-where-left-off
  enrolled_at       timestamptz
  completed_at      timestamptz
```

Format values by app:

| Format | App | Meaning |
|--------|-----|---------|
| `meeting` | Fibre Suite | A bounded facilitated session with agenda and outcomes |
| `event` | The Thread | A conference or open happening with schedule and sessions |
| `journey` | The Thread | A personal arc with milestones, steps, and reflections |
| `self_paced` | Fibre Learn | Async content with modules, lessons, and assessments |
| `blended` | Any | Combination of async content and live sessions |

### Domain 6: Activity log — platform event layer

The activity log is the only data that flows across apps. It records events, not content. The `body` field carries only a short human-readable subject. Sensitive content — facilitation notes, reflection text, assessment answers — never appears here.

```sql
activity
  id            uuid PK
  workspace_id  uuid FK → workspace
  person_id     uuid FK → person
  app_id        uuid FK → app       -- which app wrote this event
  deal_id       uuid FK → deal      -- nullable; Fibre Sales only
  type          text                -- see event taxonomy below
  subject       text                -- short, human-readable, never sensitive
  occurred_at   timestamptz
  created_by    uuid FK → user
```

Activity is append-only. Rows are never updated or deleted. If a correction is needed, write a new row with `type = 'correction'` referencing the original.

Activity event taxonomy:

| App | Event types |
|-----|-------------|
| Fibre Suite | `meeting_attended`, `meeting_facilitated`, `action_item_assigned`, `programme_completed` |
| The Thread | `event_registered`, `session_attended`, `journey_step_completed`, `programme_completed` |
| Fibre Learn | `lesson_completed`, `module_completed`, `assessment_passed`, `programme_completed` |
| Fibre Sales | `deal_won`, `call_made`, `proposal_sent`, `meeting_scheduled` |
| Platform | `user_created`, `consent_granted`, `consent_revoked`, `erasure_completed` |

### Domain 7: Fibre Sales — private tables

These tables exist only in the Fibre Sales app schema. No other app has API routes to them. RLS enforces this.

```sql
pipeline_stage
  id              uuid PK
  workspace_id    uuid FK → workspace
  name            text
  position        integer
  is_closed_won   boolean
  is_closed_lost  boolean

deal
  id              uuid PK
  workspace_id    uuid FK → workspace
  org_id          uuid FK → organisation
  owner_id        uuid FK → user
  stage_id        uuid FK → pipeline_stage
  title           text
  value_cents     integer
  currency        text              -- ISO 4217
  expected_close  date
  closed_at       date
  close_reason    text
  created_at      timestamptz
  deleted_at      timestamptz

deal_contact
  deal_id           uuid FK → deal
  person_id         uuid FK → person
  role              text            -- decision_maker | influencer | champion | gatekeeper | referrer | programme_participant
  is_primary        boolean
  is_budget_holder  boolean

line_item
  id                uuid PK
  deal_id           uuid FK → deal
  description       text
  quantity          integer
  unit_price_cents  integer

sales_activity
  id              uuid PK
  deal_id         uuid FK → deal
  person_id       uuid FK → person
  type            text              -- call | email | meeting | note | stage_change
  subject         text
  body            text              -- full content; never exposed to platform activity log
  created_by      uuid FK → user
  occurred_at     timestamptz
```

`pipeline_stage` replaces the string `stage` field from earlier versions. Each workspace configures its own stages. The `is_closed_won` and `is_closed_lost` flags drive the deal.won event and reporting.

`deal_contact.role` includes `programme_participant` — for cases where a person is enrolled in a programme that was won as a deal. This is relational context for the deal, not the enrolment. The enrolment record remains in the platform; the deal contact role remains in Fibre Sales.

### Domain 8: GDPR and privacy

```sql
consent_record
  id            uuid PK
  user_id       uuid FK → user
  person_id     uuid FK → person
  purpose_code  text              -- transactional_email | marketing_email | learning_analytics | cohort_directory | facilitation_data | sales_contact
  legal_basis   text              -- consent | legitimate_interest | contract | legal_obligation
  granted_at    timestamptz
  revoked_at    timestamptz
  text_version  text
  ip_address    inet

data_subject_request
  id            uuid PK
  person_id     uuid FK → person
  type          text              -- access | erasure | portability | rectification | restriction
  status        text              -- received | in_progress | completed | rejected
  requested_at  timestamptz
  due_at        timestamptz       -- requested_at + 30 days
  completed_at  timestamptz
  notes         text

retention_policy
  id              uuid PK
  workspace_id    uuid FK → workspace
  data_category   text            -- contact_data | activity_log | facilitation_data | sales_data | learning_data
  retention_days  integer
  legal_basis     text
  reviewed_at     date

processing_purpose
  id              uuid PK
  workspace_id    uuid FK → workspace
  purpose_code    text
  description     text
  legal_basis     text
  data_categories text[]
  third_parties   text[]
  created_at      timestamptz
```

GDPR erasure for in-app data requires a cross-app erasure handler. Each app registers a webhook endpoint that the platform calls when a `data_subject_request` of type `erasure` is fulfilled. Each app is responsible for zeroing its own sensitive data. The platform zeroes the contact graph fields. Fibre Sales zeroes its sales notes. Fibre Suite zeroes its exercise responses and facilitator notes.

---

## 6. Data ownership model

Three questions determine where a piece of data lives:

1. Is this about who someone is? → Contact graph (platform)
2. Is this about the commercial relationship? → Fibre Sales
3. Is this about what happened in a specific app context? → The app

### What lives where

**Platform contact graph holds:**
- Person: name, contact details, location, language, professional background, relationship context, change context (enduring view), learning profile
- Organisation: identity, system context, relationship stage, membership
- Person-to-person relationships
- Enrolment state (status and progress percentage — not content)
- Activity events (type and subject — not content body)
- Consent records

**Fibre Sales holds exclusively:**
- Deals, pipeline stages, proposals, line items
- Sales notes and call records (full body)
- Revenue and forecasting data
- Deal contact roles
- Org relationship stage and next opportunity (these are written by Fibre Sales; readable by platform for aggregated engagement summary only)

**Each delivery app holds exclusively:**
- Fibre Suite: agenda content, meeting outcomes, decisions, action items, exercise responses, facilitator observations
- The Thread: session schedule and selections, journey step responses, personal reflections, peer connections
- Fibre Learn: module content, video progress, assessment answers, scores

### The promotion model

Raw experience data is generated in apps. Distilled intelligence can be promoted to the platform. Promotion is always explicit — a facilitator or business developer chooses to update the contact or org record with an insight that matters beyond the current session.

Fibre Suite meeting → facilitator promotes key observation → updates `person_change_context.role_in_change`

The Thread journey → participant chooses to share reflection → updates `person_learning.development_goals`

Fibre Sales call → BizDev promotes one insight → updates `org_system_context.political_landscape`

Promotion is never automatic. The app surfaces a "save to profile" action. The user decides.

---

## 7. SSO and identity provider model

Google OAuth is live. Microsoft and LinkedIn follow the same pattern — Supabase Auth configuration plus a new `user_identity_provider` row type. No schema migration needed when adding providers.

### Matching logic on first Google sign-in

1. Look up `user_identity_provider` by `provider = 'google'` and `provider_user_id` — fastest match, use when available
2. If not found, look up `user` by `email` matching `provider_email` — links existing platform user to Google
3. If not found, create new `user` and `person` records from Google profile data (`given_name`, `family_name`, `email`, `picture`, `locale`)
4. Write `sso_match_log` row with resolution: `matched`, `linked`, or `created`

The `hd` (hosted domain) claim from Google Workspace identifies employer domain. The platform uses this to suggest org membership: "We see you're from nme.nl — link to NME Schouwen-Duiveland?" Confirmation required before linking.

OAuth tokens are managed by Supabase Auth. The platform stores only the last four characters of the access token as a debug hint — never a full token.

---

## 8. Landing platform

The landing platform at thefibre.app is the front door. It serves three audiences:

- First-time visitors: what is this, who is it for
- Returning users: get to my app
- Organisations and developers: can I build on this, can my team use this

The landing platform shows: active apps with their status, sign-in options (Google live, others coming), trust signals (GDPR, EU hosting, cooperative structure, no advertising), and a clear footer with legal entities.

Sign-in routes: Google OAuth is the primary option. Magic link is the fallback ("or use a magic link"). Microsoft and LinkedIn are shown as coming soon.

After sign-in, the platform resolves which apps the user has `app_membership` for and surfaces them. A user with access to Fibre Suite and The Thread sees both. A user with no memberships sees an access request flow.

---

## 9. API design

### Conventions

- REST over JSON
- Base path: `/api/v1/`
- Authentication: Bearer token (JWT issued by Supabase Auth)
- Tenant resolution: `workspace_id` from JWT — never from URL path
- App resolution: `X-App-ID` header on every request — enforces app-scoped data access
- Timestamps: ISO 8601, UTC
- Pagination: cursor-based (`after`, `before`, `limit`) — never offset
- Errors: RFC 7807 Problem Details

### Platform API — available to all apps

```
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
GET    /auth/me

GET    /persons
POST   /persons
GET    /persons/:id
PATCH  /persons/:id
DELETE /persons/:id
GET    /persons/:id/activities        -- events only; no content body from other apps
GET    /persons/:id/enrolments

GET    /organisations
POST   /organisations
GET    /organisations/:id
PATCH  /organisations/:id
GET    /organisations/:id/members
GET    /organisations/:id/engagement-summary   -- aggregate only; no app content

GET    /programs
POST   /programs
GET    /programs/:id
POST   /programs/:id/enrolments
PATCH  /enrolments/:id

POST   /activities                    -- write events to the log
GET    /activities                    -- read events (type + subject only)

POST   /privacy/consent
DELETE /privacy/consent/:purpose_code
GET    /privacy/export
POST   /privacy/erasure-request
GET    /privacy/dashboard
```

### Fibre Sales API — gated, fibre-sales membership required

```
GET    /deals
POST   /deals
GET    /deals/:id
PATCH  /deals/:id
POST   /deals/:id/stage
POST   /deals/:id/contacts
GET    /deals/:id/activities          -- sales_activity only; full body visible to sales users

GET    /pipeline-stages
POST   /pipeline-stages
PATCH  /pipeline-stages/:id

GET    /proposals
POST   /proposals
```

### App permission middleware

Every API request resolves:

1. `user` from JWT
2. `app_id` from `X-App-ID` header
3. `app_membership` row for this user + app
4. `role` and `permissions` from that row

RLS enforces workspace isolation. App-scoped data (Fibre Sales tables) additionally checks `app_id = 'fibre-sales'` in every RLS policy. No query crosses the wall.

---

## 10. GDPR implementation

### Consent — unbundled, always

Every `purpose_code` is a separate consent record. Bundled consent is not permitted.

| Purpose code | Legal basis | Required for |
|---|---|---|
| `transactional_email` | Contract | Invitation and notification emails |
| `marketing_email` | Consent | Newsletters, programme announcements |
| `learning_analytics` | Legitimate interest | Progress tracking, completion data |
| `cohort_directory` | Consent | Showing participant name to peers |
| `facilitation_data` | Contract | Recording attendance and session notes |
| `sales_contact` | Legitimate interest | Outreach and pipeline communication |

### Cross-app erasure

When a `data_subject_request` of type `erasure` is fulfilled:

1. Platform zeroes all personal fields on `person` and profile tables, sets `deleted_at`
2. Platform fires erasure webhooks to each app that has enrolment data for this person
3. Fibre Suite handler zeroes exercise responses and facilitator notes for this person
4. The Thread handler zeroes journey reflections and personal notes
5. Fibre Sales handler zeroes sales notes where this person is the subject
6. Each app confirms completion; platform marks `data_subject_request.status = 'completed'`

Structural rows (enrolments, activity events, deal_contact rows) are retained for referential integrity. Personal content fields are zeroed.

### Data subject rights (30-day response window — GDPR Art. 12)

- Article 15: `GET /privacy/export` — complete JSON of all platform data held
- Article 17: Erasure request — triggers cross-app erasure flow above
- Article 20: Portability — same as access with schema definition included
- Article 16: Rectification — person can update their own fields via privacy dashboard

---

## 11. Multi-tenancy

Each `workspace` is an isolated tenant. Two enforcement levels:

Application layer: every query includes `workspace_id` from JWT. API rejects mismatches.

Database layer: PostgreSQL RLS on every table. Policy pattern: `USING (workspace_id = (auth.jwt() ->> 'workspace_id')::uuid)`. Even if the application layer fails, rows from other workspaces are invisible.

Fibre Sales tables add a second RLS condition: `AND (SELECT app_id FROM app_membership WHERE user_id = auth.uid() AND app_id = 'fibre-sales') IS NOT NULL`.

---

## 12. Project phases

### Phase 0 — Foundation (weeks 1–4)
- Monorepo setup
- Supabase EU region confirmed
- Schema: identity, user_identity_provider, contact graph (person + org + profiles)
- Auth: magic link + Google OAuth
- SSO match logic and sso_match_log
- RLS on all tables
- Soft delete pattern established

### Phase 1 — Contact graph and landing (weeks 5–8)
- Full contact graph API: persons, organisations, org_membership, relationships
- Landing platform UI
- Privacy dashboard (basic)
- Activity log write path

### Phase 2 — Programme layer (weeks 9–11)
- Program and enrolment schema
- Enrolment lifecycle
- Activity event taxonomy implemented
- App registration and app_membership middleware

### Phase 3 — GDPR layer (weeks 12–14)
- Full consent model
- Privacy dashboard (complete)
- Data export (Article 20)
- Erasure flow with cross-app webhook pattern
- Retention policy engine

### Phase 4 — Fibre Sales (weeks 15–19)
- Fibre Sales app schema (deals, pipeline, proposals)
- Fibre Sales API (gated)
- deal.won → programme handover webhook
- Org engagement summary endpoint

### Phase 5 — App integration (weeks 20+)
- Fibre Suite integration (meeting format)
- The Thread integration (event + journey formats)
- Fibre Learn architecture (future — reserved)

---

## 13. Developer implementation rules

1. **UUID everywhere.** `gen_random_uuid()`. Never auto-increment integers.
2. **Money as integers.** `value_cents integer`. Never float. Never decimal for money. Convert at display time.
3. **Soft delete.** `deleted_at timestamptz`. Never `DELETE FROM` personal data. All queries filter `WHERE deleted_at IS NULL` by default.
4. **Timestamps UTC.** `timestamptz` everywhere. Convert to user locale at display time only.
5. **RLS is mandatory.** Every table has RLS. Every policy includes `workspace_id`. Fibre Sales tables add app membership check. Test with a second workspace before shipping any feature.
6. **No unbundled consent.** Email service checks for valid `consent_record` before every send. The check is in the email service, not in the caller.
7. **Activity is append-only.** Never update or delete activity rows. Corrections are new rows with `type = 'correction'`.
8. **No cross-app content reads.** An app may read `GET /persons/:id` and `GET /activities` (events only). It may never call another app's internal schema or API to read content, notes, scores, or responses.
9. **X-App-ID on every request.** Every app sets this header. The middleware resolves app_membership. Requests without it are rejected.
10. **The data wall is structural.** Not a convention, not a gentleman's agreement. RLS enforces it. The API enforces it. The schema enforces it.
11. **Cursor pagination only.** No offset. Cursor-based on all list endpoints.
12. **API versioning from day one.** All routes `/api/v1/`. Breaking changes become `/api/v2/`.
13. **No personal data in Vercel.** This is a hard constraint, not a guideline. Next.js API routes and Edge Functions running on Vercel may not query, process, store, or log personal data. Vercel states explicitly that no data is stored permanently in EU regions — ephemeral caching only, with US infrastructure involved for DDoS protection regardless of region configuration. All personal data operations route through the backend API on Fly.io or Railway EU. Frontend functions may: call the backend API, read non-personal environment config, return rendered HTML. They may not: query Supabase directly for personal data, write to the activity log, process consent records, or handle any data covered by GDPR. A developer who routes a personal data query through a Next.js API route has silently broken the GDPR architecture. Review this in every code review. Flag it in CI if possible via a lint rule banning direct Supabase client imports in the `/app/api` directory.
14. **Connection pooling from day one.** Use the Supabase PgBouncer pooling endpoint (port 6543, transaction mode) — not the direct connection string — from the first migration. Multiple apps running concurrently against a direct connection string will exhaust the connection limit. This is not a retrofit; it is a Phase 0 requirement.

---

## 15. Design principles

### The Fibre as product

The name is the brief. Fibre is the material The Thread is made from. It is what gives things tensile strength. It is what connects. The platform is not a tool — it is the substance that makes every app more coherent, more intelligent, and more trustworthy than it would be alone.

The contact and activity intelligence layer is the product differentiator. When a facilitator opens a person record in The Fibre, they are opening the fullest picture of a human being in a professional and transformational context that anyone has earned the right to hold. That picture is built from events written by Fibre Suite, The Thread, Fibre Learn, and Fibre Sales over time — each staying within its own wall, but each contributing its signal to the shared intelligence.

This is not a CRM. It is relationship intelligence for purpose-driven work.

### European quality standard

The Fibre is designed to the standard that European users in professional, civic, and educational contexts expect from software handling their personal data. This is about trust, not aesthetics.

No dark patterns. No advertising. No profiling. No selling data. The privacy dashboard is a first-class product feature. Error messages are honest.

Infrastructure: EU only. Domain: thefibre.app. Legal entity: Dutch cooperative. Governance: member-owned. These are not marketing claims — they are structural facts visible in the footer of every page.

### Interface direction

Clean, minimal, typographically precise. The aesthetic follows from the ethics: a platform that respects attention and data does not fill the screen with noise.

Reference points: Linear, Basecamp, Notion — interfaces that treat the user as competent. The W Social principle: verified humans, EU law, data in Europe. The cooperative structure is part of the product, not behind it.

---

*End of brief. Questions and clarifications: route to Sjoerd before beginning implementation.*
