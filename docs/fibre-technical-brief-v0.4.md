# The Fibre — Technical Briefing
**Version:** 0.4
**Supersedes:** v0.3 (kept in repo for traceability)
**Owner:** Sjoerd / Solidarity Lab B.V.
**Domain:** thefibre.app
**Purpose:** Reference document for Claude Code implementation
**Changes from v0.3:** Two structural principles formalised — per-app profile tabs (§2 + §6) and *the app justifies the field* (§5 + §10). Curator-data tables (`person_professional`, `person_change_context`, `person_learning`, `org_identity`, `org_system_context`, `person_relationship_context`, `org_relationship`) are now app-owned via an `app_id` foreign key — they remain in the platform schema for storage and RLS, but each row is justified by a specific app. The platform itself only owns identity, contact graph (person + org core), enrolment state, activity events, and consent.

---

## 1. What this is

### Product vision

Most CRMs store what happened. A call was made. A deal was won. A session was attended. The record is transactional — a log of touches with no connective tissue.

The Fibre is different. A contact record in The Fibre is a living portrait of a person in the context of purpose-driven work. Their role in transformation. Their blockers and motivators. Their learning history. The meetings they attended, the journeys they walked, the moments that shifted something. The facilitator's observation from three years ago sitting alongside last week's session attendance and the open deal with their employer.

The timeline is the product. Not the pipeline. Not the programme. The accumulated record of every meaningful interaction — across every app, across every context, across time — held in one place, governed by European standards, owned by a cooperative.

The Fibre holds The Thread. That sentence is true in both directions.

### What the platform is

The Fibre is a multi-tenant identity, contact, and relationship foundation for a family of purpose-driven applications. It is **not** a maximalist contact-graph that stores everything just in case. It is **a thin identity layer** with apps registering the fields they actually need. Each stored field traces back to a specific app and a specific processing purpose.

The platform itself owns:
- Single Sign-On (SSO) across all apps — Google OAuth live, Microsoft and LinkedIn planned
- The **identity layer**: persons (name, contact details, languages, location), organisations (basic identity, hierarchy)
- The **contact graph edges**: org membership, person ↔ person relationships, tags
- The **shared activity event log** — append-only, type + subject only, never content body
- Programme and enrolment state
- App-level user roles and permissions per app
- Consent and GDPR-native data architecture
- A public landing platform at thefibre.app routing visitors to their app

Each **app** owns:
- Its own content (notes, responses, scores, agendas, reflections — never platform)
- The **curator-data extension fields** it specifically needs on persons and orgs (e.g. learning style for Fibre Learn; change context for Fibre Meet; relationship context for Fibre Sales)

The platform does not store any app-specific content. What happens inside an app stays inside that app. Only events cross the wall. But those events, accumulated over time across all apps, are the intelligence that makes a contact record worth opening.

---

## 2. Application family

| App | Slug | Domain | Description | Format values | Status |
|-----|------|--------|-------------|---------------|--------|
| Fibre Platform | `fibre-platform` | thefibre.app | The platform itself — identity, contact graph, activity, privacy | — | Active |
| Fibre Meet | `fibre-meet` | meet.thefibre.app | Meeting platform — agenda, facilitation, outcomes | `meeting` | Active |
| The Thread | `the-thread` | thread.thefibre.app | Event and journey platform — conferences, personal arcs | `event`, `journey` | Active |
| Fibre Sales | `fibre-sales` | sales.thefibre.app | Sales pipeline and account management — sovereign, gated | n/a | To be built |
| Fibre Learn | `fibre-learn` | learn.thefibre.app | Self-paced content platform — modules, assessments | `self_paced`, `blended` | Future |
| Partner apps | varies | varies | Third-party apps built on The Fibre API | varies | Future |

Every app authenticates through the same identity layer. One login, all apps. What differs per app: roles, permissions, the content that lives inside the app's own schema, and **the curator-data fields that app registers on persons and organisations**.

### The data wall

This is the governing architectural principle. State it once, enforce it everywhere.

> The person travels. The experience stays. Only events cross the wall.

- The **platform** holds: identity, contact graph edges (membership, relationships, tags), enrolment state, activity events, consent
- Each **app** holds:
  - its own content, notes, responses, scores, outcomes, media (in its own schema)
  - the curator-data fields it justifies on persons/orgs (stored in the platform schema but tagged with `app_id`)
- No app reads another app's content data — ever
- The activity log records that something happened — not what was said, scored, or reflected

### The profile structure (new in v0.4)

A person's or organisation's profile in The Fibre is composed of:

- **One Identity tab** (Fibre Platform) — name, contact details, location, languages, org membership
- **One tab per app** the person/org has actually interacted with. Tabs appear emergently:
  - The Thread → event registrations, sessions attended, journey progress
  - Fibre Meet → meetings attended/facilitated, action items, change-context observations
  - Fibre Sales → deal contacts, relationship context, engagement summary (gated by app membership)
  - Fibre Learn → learning profile, lessons completed, assessments

A contact who has only attended a Thread event has only Identity + Thread tabs. They never see Suite or Sales. The platform stores their identity; The Thread justifies the curator-data fields about them.

---

## 3. App identities

### Fibre Platform — the substance

Fibre Platform is the identity and contact-graph layer. It owns:
- Persons (core identity, contact details, location, languages)
- Organisations (name, legal name, domain, sector, hierarchy)
- Org membership (person ↔ org with title, role, dates)
- Person ↔ person relationships
- Tags
- Activity event log
- Enrolment state (status + progress only — never content)
- Consent records and data subject requests

It does *not* own facilitator observations, sales relationships, or learning styles — those are app-owned.

### Fibre Meet — meeting platform

Fibre Meet's unit of work is the meeting. A meeting has a before (agenda design), a during (live facilitation), and an after (outcomes, decisions, action items).

Fibre Meet owns internally: agenda items and structure, meeting outcomes and decisions, action items with owners and due dates, exercise responses (sensitive — never leaves Fibre Meet), room logistics.

Fibre Meet owns on the platform (via `app_id = 'fibre-meet'` rows in shared profile tables): **change context** — role in change, blockers, motivators, facilitator notes (Sensitive), readiness level.

Fibre Meet writes to the activity log: `meeting_attended`, `meeting_facilitated`, `action_item_assigned`, `programme_completed` — type + subject only.

### The Thread — event and journey platform

The Thread owns internally: session schedule and selections (event), personal reflections and journey responses (journey), milestone completion, peer connections made, event materials, cohort directory.

The Thread owns on the platform (via `app_id = 'the-thread'`): event-specific person attributes — dietary requirements, accessibility needs, t-shirt size, cohort directory consent flags.

The Thread writes to the activity log: `event_registered`, `session_attended`, `journey_step_completed`, `programme_completed` — type + subject only, no reflection content.

### Fibre Sales — sovereign, gated

Fibre Sales is gated behind its own `app_membership`. A facilitator in Fibre Meet has no access. A participant in The Thread has no access.

Fibre Sales owns exclusively (in its own schema): deals and pipeline stages, deal contacts and roles, line items and proposals, revenue data, sales notes (full body, never exposed to platform activity log), forecasting, touchpoint history.

Fibre Sales owns on the platform (via `app_id = 'fibre-sales'`): **person relationship context** (source, strength, communication preference, ambassador flag); **org relationship** (relationship stage, health status, engagement type, programmes completed).

Fibre Sales reads from the platform: person and organisation profiles, activity event timeline (events only).

Fibre Sales writes to the activity log: `deal_won`, `call_made`, `proposal_sent`, `meeting_scheduled` — subject only.

The deal.won event is the seam between sales and delivery. It triggers a platform webhook that creates a programme in the appropriate delivery app.

### Fibre Learn — future

When built, Fibre Learn owns internally: module and lesson content, video watch position, assessment questions and answers, quiz attempt history, scores, certificates.

Fibre Learn owns on the platform (via `app_id = 'fibre-learn'`): **learning profile** — learning interests, prior programmes, learning style, group role tendency, development goals, openness flags. Post-programme reflection (participant-owned, GDPR-special).

Fibre Learn writes to the activity log: `lesson_completed`, `module_completed`, `assessment_passed`, `programme_completed`.

---

## 4. Technology choices

(unchanged from v0.3 — see [`fibre-technical-brief-v0.3.md`](fibre-technical-brief-v0.3.md) §4 for the full rationale: Supabase managed Frankfurt or Ireland with self-host migration path; Vercel for stateless frontends only; EU-resident backend on Fly.io or Railway; PostgreSQL RLS as the multi-tenant enforcement layer.)

---

## 5. Data model

All tables use UUID primary keys. All personal data tables carry `created_at` and `deleted_at` (soft delete — never hard delete personal data). Money always stored as integer cents, never float.

### Domain 1: identity and tenancy

(Unchanged from v0.3 §5 Domain 1 — workspace, user, user_identity_provider, sso_match_log, app, app_membership, session.)

### Domain 2: person — identity layer only

```sql
person
  id                  uuid PK
  user_id             uuid FK → user    -- nullable
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
  country             text
  preferred_language  text
  languages_spoken    text[]
  custom_fields       jsonb
  created_at          timestamptz
  deleted_at          timestamptz
```

That's it for what the platform itself stores about persons. **All other fields previously in v0.3 are app-owned** (see Domain 5 below).

### Domain 3: organisation — identity layer only

```sql
organisation
  id                  uuid PK
  workspace_id        uuid FK → workspace
  parent_org_id       uuid FK → organisation   -- self-referential
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
  size_band           text
  sector              text
  industry            text
  org_type            text
  logo_url            text
  created_at          timestamptz
  deleted_at          timestamptz

org_membership
  id                uuid PK
  person_id         uuid FK → person
  org_id            uuid FK → organisation
  title             text
  department        text
  sub_department    text
  seniority_level   text
  employment_type   text
  influence_level   text
  is_primary        boolean
  is_decision_maker boolean
  is_budget_holder  boolean
  is_champion       boolean
  started_at        date
  ended_at          date
```

### Domain 4: relationships and tags

```sql
relationship (person ↔ person)
  id              uuid PK
  workspace_id    uuid FK → workspace
  from_person_id  uuid FK → person
  to_person_id    uuid FK → person
  type            text
  strength        text
  notes           text
  created_at      timestamptz

tag
  id            uuid PK
  workspace_id  uuid FK → workspace
  name          text
  color         text

person_tag (person ↔ tag)
org_tag (org ↔ tag)
```

### Domain 5: app-owned extensions on persons and organisations *(new in v0.4)*

These tables live in the platform schema for storage convenience and shared RLS, but each row is **app-owned via an `app_id` foreign key**. The app that owns the row is the only one whose users should see and edit those fields. The same person can have multiple rows of the same extension if multiple apps each store their own perspective — but in practice each app gets one row per person.

```sql
person_app_profile
  id            uuid PK
  person_id     uuid FK → person
  app_id        uuid FK → app
  fields        jsonb         -- app-specific schema, validated by the app
  updated_at    timestamptz
  updated_by    uuid FK → user
  unique (person_id, app_id)

org_app_profile
  id            uuid PK
  org_id        uuid FK → organisation
  app_id        uuid FK → app
  fields        jsonb
  updated_at    timestamptz
  updated_by    uuid FK → user
  unique (org_id, app_id)
```

Each app defines its own validation schema for `fields`. Examples of what apps register:

- `app_id = fibre-meet` person fields: `role_in_change`, `stance_on_change`, `change_themes` (text[]), `blockers` (text[]), `motivators` (text[]), `current_challenge`, `facilitator_notes` (**Sensitive**, access-controlled), `readiness_level`
- `app_id = the-thread` person fields: `dietary_requirements`, `accessibility_needs`, `cohort_directory_visible` (boolean), `preferred_session_tracks` (text[])
- `app_id = fibre-sales` person fields: `source`, `source_detail`, `introduced_by` (uuid), `relationship_strength`, `communication_preference`, `best_time_to_reach`, `is_key_contact` (boolean), `is_ambassador` (boolean), `first_contact_notes`, `first_contact_at`
- `app_id = fibre-learn` person fields: `learning_interests` (text[]), `prior_programmes` (text[]), `learning_style`, `group_role_tendency`, `development_goals`, `post_programme_reflection` (**Participant-owned**), `open_to_coaching`, `open_to_peer_exchange`
- `app_id = fibre-platform` person fields: `professional` (current_title, current_department, seniority_level, sector, expertise_areas, years_of_experience, career_stage, is_independent, certifications, spoken_at_events) — the only "general professional info" considered platform-justified

Sensitive fields are still flagged inside the app schema and remain access-controlled. They never leave the app's perspective.

### Domain 6: programme and enrolment

(Unchanged from v0.3 §5 Domain 5 — `program` and `enrolment`, with `format` field driving which app the programme belongs to.)

### Domain 7: activity log

(Unchanged from v0.3 §5 Domain 6 — append-only `activity` table, type + subject only, never content body.)

### Domain 8: Fibre Sales private tables

(Unchanged from v0.3 §5 Domain 7 — `pipeline_stage`, `deal`, `deal_contact`, `line_item`, `sales_activity`. These live in their own schema for RLS gating.)

### Domain 9: GDPR and privacy

(Unchanged from v0.3 §5 Domain 8 — `consent_record`, `data_subject_request`, `retention_policy`, `processing_purpose`.)

---

## 6. Data ownership model

Five questions determine where a piece of data lives:

1. Is this about *who someone is*? → Platform identity layer (person, organisation tables)
2. Is this an edge in the contact graph? → Platform (org_membership, relationship, tag)
3. Is this a *cross-app event* — "X happened to Y in app Z"? → Platform activity log
4. Is this *enrolment state* — status, progress %? → Platform enrolment table
5. Is this *curator-data justified by a specific app*? → That app's row in `person_app_profile` / `org_app_profile`

If none of the above — it's content. Stays inside the app's own schema, never touches the platform.

### The data minimisation principle

> A field exists in the platform only because an app needs it.

No field is collected "in case someone might want it later". Each app registers the fields it needs. When a workspace doesn't have that app activated, those fields aren't shown and (eventually) aren't stored.

This honours **GDPR Article 5(1)(c)** (data minimisation) and **Article 5(1)(b)** (purpose limitation) by construction.

### The promotion model

Raw experience data is generated in apps. Distilled intelligence can be promoted to the platform's identity layer or to an app-owned profile by the participant or by a curator with permission.

Promotion is always explicit. Promotion is one-way — the platform fields become independent of the source data in the app.

---

## 7. SSO and identity provider model

(Unchanged from v0.3 §7 — Google OAuth live; matching by `provider_user_id` then email then create. Microsoft and LinkedIn pending.)

---

## 8. Landing platform

(Unchanged from v0.3 §8 — thefibre.app as the front door, sign-in routing to apps via `app_membership`.)

---

## 9. API design

### Conventions

(Unchanged from v0.3 — REST/JSON, `/api/v1/`, JWT bearer, `X-App-ID` header, ISO 8601 UTC, cursor pagination, RFC 7807 errors.)

### Platform API — available to all apps

(Same as v0.3 §9 — auth, persons, organisations, programmes, enrolments, activities, privacy.)

### App-extension API — new in v0.4

```
GET    /persons/:id/profile/:app_slug          -- read this app's curator fields for this person
PATCH  /persons/:id/profile/:app_slug          -- upsert this app's curator fields
GET    /organisations/:id/profile/:app_slug    -- same for org
PATCH  /organisations/:id/profile/:app_slug
```

The endpoint resolves the row in `person_app_profile` / `org_app_profile`, validates `fields` against the app's registered schema, and writes. RLS additionally requires the calling user to have `app_membership` for that app.

### Fibre Sales API — gated (unchanged)

(Same as v0.3.)

---

## 10. GDPR implementation

### Consent — unbundled, always

(Same as v0.3 §10. Six purpose codes, unbundled by construction.)

### Data minimisation by construction (new in v0.4)

The architecture itself enforces data minimisation. The platform stores only:
- Identity (name, contact, location)
- Contact graph edges
- Enrolment state
- Activity events (type + subject)
- Consent

Anything richer is stored only if an app justifies it via `person_app_profile` / `org_app_profile`. Removing an app's authorisation removes the lawful basis to keep its fields.

### Cross-app erasure

(Same as v0.3.)

### Data subject rights

(Same as v0.3 — 30-day Article 12 window, Articles 15/17/20/16 endpoints.)

---

## 11. Multi-tenancy

(Unchanged from v0.3 — workspace-scoped RLS on every table; Fibre Sales tables add an app-membership RLS clause.)

---

## 12. Project phases

(See [`docs/build-plan.md`](build-plan.md) for the live operational plan. The principles in v0.4 are layered on top of the existing phase structure — no schedule reset.)

---

## 13. Developer implementation rules

(Unchanged from v0.3 §13. The new principle "the app justifies the field" is structural; implementation rule 14 added below.)

15. **Every curator-data field has an owning app.** When adding a field to `person_app_profile` / `org_app_profile`, declare its `app_id`. If no app justifies it, don't add it. Review this in every code review.

---

## 14. Migration from v0.3 schema

The v0.3 schema declared rich curator tables on the platform: `person_professional`, `person_relationship_context`, `person_change_context`, `person_learning`, `org_identity`, `org_system_context`, `org_relationship`. Those tables exist in production.

v0.4 introduces `person_app_profile` and `org_app_profile` as the *new* canonical home for app-owned curator data. The existing v0.3 tables are **retained and tagged with `app_id`** in a transition phase:

1. Add `app_id` column to each existing v0.3 curator table (FK to `app`, NOT NULL).
2. Backfill `app_id` based on the field group's logical home:
   - `person_professional` → `fibre-platform` (general professional info accepted as platform-level for now; could be moved to a future "Fibre People" app)
   - `person_relationship_context` → `fibre-sales`
   - `person_change_context` → `fibre-meet`
   - `person_learning` → `fibre-learn`
   - `org_identity` → `fibre-platform`
   - `org_system_context` → `fibre-meet`
   - `org_relationship` → `fibre-sales`
3. Update RLS policies so each curator table is only visible to users with `app_membership` for the table's `app_id`.
4. The UI surfaces these fields under the relevant app's profile tab. Sections vanish when the workspace has no users for that app.
5. **Future:** consolidate into `person_app_profile` / `org_app_profile` once the schema stabilises and the per-app field-sets are validated.

This preserves all data, makes the new principle visible immediately, and defers the schema consolidation until apps are real.

---

## 15. Design principles

### The Fibre as product

The platform is not a tool — it is the substance that makes every app more coherent, more intelligent, and more trustworthy than it would be alone.

When a facilitator opens a person record in The Fibre, they are opening the fullest picture of a human being in a professional and transformational context that anyone has earned the right to hold. **The picture is built from apps over time — each staying within its own wall, each contributing its signal to the shared intelligence.** The platform itself stores only the spine: identity, contact graph, activity log.

### The app justifies the field

A field exists in the platform only because an app needs it. No "general useless stuff". If no app requires "political views" or "change themes" or any other piece of curator data, the platform doesn't collect it.

This is both a design principle and a GDPR compliance posture (Article 5(1)(c)). It makes the system honest — every field traces back to a specific app and a specific processing purpose.

### European quality standard

(Unchanged from v0.3 §15.)

### Interface direction

(Unchanged from v0.3 §15 — Linear, Basecamp, Notion. Clean, minimal, typographically precise.)

---

*End of brief v0.4. Supersedes v0.3 for new work. The v0.3 brief is retained in the repo for traceability of the schema evolution.*
