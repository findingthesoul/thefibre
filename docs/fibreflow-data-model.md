# Fibre Flow — Data model & scaffolding plan

*Companion to [`fibreflow-brief-v0.3.md`](fibreflow-brief-v0.3.md) and [`fibreflow-review.md`](fibreflow-review.md). Written 2026-05-17 against The Fibre at v0.10.0.*

> **Terminology note.** "Platform" = **The Fibre** (the core). Fibre Flow is an app on top of The Fibre, the same way Fibre Meet is. `workspace`, `team`, `person`, `organisation`, `activity` are Fibre concepts; Flow uses them as-is.

This is the proposed schema and the order of operations to scaffold `apps/flow`. Assumes the §4 recommendations in the review doc are accepted (configurable gate logic, snapshot versioning, new run per re-entry, default tasks, `meet_team` reuse, in-app notifications, manual Drive URLs).

---

## 1. Schema overview

Two namespaces:

- **`public` (platform):** Fibre Flow reads `person`, `organisation`, `user`, `team` (renamed from `meet_team` in the prep migration — see §6 Step 0), `activity`, `app_membership`. Writes only to `activity` and (optionally) `person_app_profile`.

**Naming convention (revised 2026-05-20):** Flow tables live in `public` with the `flow_` prefix, matching the Meet pattern (`meet_team`, `meet_booking`, …). The schema sketch below originally used a dedicated `flow.` schema; the actual migration uses `public.flow_*` for RLS / PostgREST simplicity. The conceptual mapping:

| Conceptual name (this doc) | Actual table              |
| -------------------------- | ------------------------- |
| `flow.flow`                | `public.flow_definition`  |
| `flow.flow_version`        | `public.flow_version`     |
| `flow.step`                | `public.flow_step`        |
| `flow.transition`          | `public.flow_transition`  |
| `flow.gate_task_template`  | `public.flow_gate_task`   |
| `flow.step_default_task`   | `public.flow_step_default_task` |
| `flow.flow_run`            | `public.flow_run`         |
| `flow.task`                | `public.flow_task`        |
| `flow.document_link`       | `public.flow_document_link` |

`flow.flow` was renamed to `flow_definition` to avoid the awkward `flow.flow_*` namespace clash. Authoritative schema lives in [`supabase/migrations/20260520120000_fibre_flow_schema.sql`](../supabase/migrations/20260520120000_fibre_flow_schema.sql).
- **`flow` (app-private):** new schema. Holds flow definitions, runs, tasks, document links.

Register the app:

```sql
insert into public.app (id, slug, name) values
  ('flow', 'fibre-flow', 'Fibre Flow');
```

---

## 2. Tables (Fibre Flow private)

```sql
-- 2.1 Flow definitions (versioned)
create table flow.flow (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id),
  app_id          text not null default 'flow',
  name            text not null,
  description     text,
  scope           text not null check (scope in ('personal','team','workspace')),
  owner_user_id   uuid not null references public.user(id),     -- personal scope: owner; team/workspace: creator
  team_id         uuid references public.team(id),          -- required iff scope='team' (see review §2.2)
  visibility      text not null default 'members_only' check (visibility in ('members_only','org_wide')),
  lifecycle       text not null default 'draft' check (lifecycle in ('draft','active','closed','archived')),
  current_version_id uuid,                                       -- FK set after first version row exists
  created_at      timestamptz not null default now(),
  created_by      uuid not null references public.user(id),
  deleted_at      timestamptz,
  check ((scope = 'team') = (team_id is not null))
);

create table flow.flow_version (
  id              uuid primary key default gen_random_uuid(),
  flow_id         uuid not null references flow.flow(id) on delete cascade,
  version_number  int not null,
  published_at    timestamptz,                                   -- null = draft
  created_at      timestamptz not null default now(),
  created_by      uuid not null references public.user(id),
  unique (flow_id, version_number)
);

alter table flow.flow
  add constraint flow_current_version_fk
  foreign key (current_version_id) references flow.flow_version(id);

-- 2.2 Graph (per flow version)
create table flow.step (
  id              uuid primary key default gen_random_uuid(),
  flow_version_id uuid not null references flow.flow_version(id) on delete cascade,
  key             text not null,                                 -- stable within a version, e.g. 'proposal_sent'
  name            text not null,
  description     text,
  kind            text not null default 'normal' check (kind in ('entry','normal','end_positive','end_negative')),
  expected_duration_days int,
  default_assignee_role text,                                    -- 'owner' | 'admin' | free text
  canvas_x        real,
  canvas_y        real,
  unique (flow_version_id, key)
);

create table flow.transition (
  id              uuid primary key default gen_random_uuid(),
  flow_version_id uuid not null references flow.flow_version(id) on delete cascade,
  from_step_id    uuid not null references flow.step(id) on delete cascade,
  to_step_id      uuid not null references flow.step(id) on delete cascade,
  label           text not null,
  gate_logic      text not null default 'all' check (gate_logic in ('all','any')),
  ordinal         int not null default 0
);

-- Gate task templates: what tasks must be completed to take this transition
create table flow.gate_task_template (
  id              uuid primary key default gen_random_uuid(),
  transition_id   uuid not null references flow.transition(id) on delete cascade,
  title           text not null,
  description     text,
  actor_type      text not null check (actor_type in ('personal','team','contact')),
  default_assignee_role text,                                    -- 'owner', 'team_member', null
  contact_action_type text,                                      -- only when actor_type='contact'; e.g. 'fibre-meet.meeting.attended'
  required        boolean not null default true,                 -- gate_logic='any' uses 'required=false' to allow OR-of-required
  ordinal         int not null default 0
);

-- Tasks auto-created when a contact enters a step (not tied to a transition)
create table flow.step_default_task (
  id              uuid primary key default gen_random_uuid(),
  step_id         uuid not null references flow.step(id) on delete cascade,
  title           text not null,
  description     text,
  actor_type      text not null check (actor_type in ('personal','team','contact')),
  default_assignee_role text,
  due_days_after_entry int,
  ordinal         int not null default 0
);

-- 2.3 Runtime: a contact's journey through one flow
create table flow.flow_run (
  id              uuid primary key default gen_random_uuid(),
  flow_id         uuid not null references flow.flow(id),
  flow_version_id uuid not null references flow.flow_version(id),    -- snapshot on entry (review §4 Q2)
  person_id       uuid not null references public.person(id),
  organisation_id uuid references public.organisation(id),            -- denorm convenience
  current_step_id uuid not null references flow.step(id),
  owner_user_id   uuid references public.user(id),                    -- who's accountable for this contact in this run
  status          text not null default 'active' check (status in ('active','completed','withdrawn')),
  entered_at      timestamptz not null default now(),
  current_step_entered_at timestamptz not null default now(),
  completed_at    timestamptz,
  deleted_at      timestamptz
  -- no unique on (flow_id, person_id): re-entry allowed (review §4 Q3)
);

create index flow_run_person on flow.flow_run(person_id) where deleted_at is null;
create index flow_run_current_step on flow.flow_run(current_step_id) where status='active';

-- 2.4 Tasks (the to-do system)
create table flow.task (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id),
  flow_run_id     uuid references flow.flow_run(id) on delete cascade, -- null = manual task
  gate_task_template_id uuid references flow.gate_task_template(id),  -- non-null iff this is a gate task
  step_default_template_id uuid references flow.step_default_task(id),
  title           text not null,
  description     text,
  actor_type      text not null check (actor_type in ('personal','team','contact')),
  assignee_user_id uuid references public.user(id),
  assignee_team_id uuid references public.team(id),
  contact_id      uuid references public.person(id),
  organisation_id uuid references public.organisation(id),
  due_at          timestamptz,
  status          text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  completed_at    timestamptz,
  completed_by    uuid references public.user(id),
  created_at      timestamptz not null default now(),
  created_by      uuid not null references public.user(id),
  deleted_at      timestamptz
);

create index task_assignee on flow.task(assignee_user_id, status) where deleted_at is null;
create index task_contact on flow.task(contact_id) where deleted_at is null;
create index task_due on flow.task(due_at) where status in ('open','in_progress');

-- 2.5 Documents (manual URL paste)
create table flow.document_link (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspace(id),
  url             text not null,
  title           text,
  attached_to     text not null check (attached_to in ('person','organisation','flow_step','flow_run')),
  person_id       uuid references public.person(id),
  organisation_id uuid references public.organisation(id),
  step_id         uuid references flow.step(id),
  flow_run_id     uuid references flow.flow_run(id),
  created_at      timestamptz not null default now(),
  created_by      uuid not null references public.user(id),
  deleted_at      timestamptz
);
```

---

## 3. Activity event types

Fibre Flow writes these to `public.activity` (id `'flow'`, subject = `person_id`):

| `type`                                | When                                              | `subject` |
| ------------------------------------- | ------------------------------------------------- | --------- |
| `flow.run.started`                    | Contact added to a flow                           | person    |
| `flow.run.step_changed`               | Transition fired (manual or auto)                 | person    |
| `flow.run.completed`                  | Run reached end state                             | person    |
| `flow.run.withdrawn`                  | Run cancelled                                     | person    |
| `flow.task.completed`                 | Any task (incl. contact-action logging) closed   | person    |

Fibre Flow **reads** these from other apps to satisfy contact gate tasks:

| Read `app_id` | Read `type`                       | Maps to gate `contact_action_type`               |
| ------------- | --------------------------------- | ------------------------------------------------ |
| `fibre-meet`  | `meet.booking.completed`          | `fibre-meet.meeting.attended`                    |
| `the-thread`  | `thread.enrolment.attended`       | `the-thread.session.attended`                    |
| `fibre-flow`  | `flow.task.completed`             | (internal — when a previous step closed)         |

A background job (or trigger) scans for unmet contact gate tasks whose `contact_action_type` matches a recently-written activity for the same `person_id`, and auto-completes them. Cron, not real-time — Phase 1.

---

## 4. RLS sketch

Workspace + scope + visibility, mirroring the Meet pattern from v0.9.0.

```sql
-- flow.flow
create policy flow_select on flow.flow for select to authenticated using (
  workspace_id = public.current_workspace_id()
  and deleted_at is null
  and (
    scope = 'workspace'
    or (scope = 'personal' and owner_user_id = public.current_app_user_id())
    or (scope = 'team' and team_id in (select team_id from public.team_member where user_id = public.current_app_user_id()))
  )
);
```

Same shape applies to `flow_run` (visibility inherits from parent flow) and `task` (assignee or in a visible flow).

---

## 5. API surface (Hono, `apps/api/src/routes/flow.ts`)

```
GET    /api/v1/flow/flows                       list flows (scope filter)
POST   /api/v1/flow/flows                       create draft flow
GET    /api/v1/flow/flows/:id                   flow + current version graph
PATCH  /api/v1/flow/flows/:id                   metadata
POST   /api/v1/flow/flows/:id/versions          new draft version
POST   /api/v1/flow/flows/:id/versions/:vid/publish

GET    /api/v1/flow/flows/:id/runs              runs in this flow (cursor)
POST   /api/v1/flow/flows/:id/runs              add contact to flow
GET    /api/v1/flow/runs/:id                    run + open tasks + history
POST   /api/v1/flow/runs/:id/transition         move to next step (validates gate)
POST   /api/v1/flow/runs/:id/withdraw

GET    /api/v1/flow/tasks                       my tasks / team tasks (filter)
POST   /api/v1/flow/tasks                       manual task
PATCH  /api/v1/flow/tasks/:id                   update / complete

GET    /api/v1/flow/contacts/:personId/runs     all of this contact's runs (for contact-detail tab)
GET    /api/v1/flow/contacts/:personId/tasks    all open tasks for this contact

POST   /api/v1/flow/document-links
DELETE /api/v1/flow/document-links/:id

POST   /api/v1/flow/erasure                     GDPR cross-app erasure webhook target
```

All routes require `X-App-ID: fibre-flow` (already enforced by the API).

---

## 6. Scaffolding plan — order of operations

The order matters: each step is shippable and produces a visible change.

### Step 0 — Platform prep: rename `meet_team` → `team` (½ day) *(decided 2026-05-17)*
- Single migration: `alter table public.meet_team rename to team;` + `meet_team_member` → `team_member`. Update FKs, indexes, RLS policy names.
- Codemod across `apps/api`, `apps/web`, `apps/meet`, `packages/shared`.
- Full `pnpm -r typecheck`, deploy, smoke-test Meet team pages.
- This unblocks Flow consuming `public.team` natively. Approvals on review §4 answers already locked.

### Step 1 — Schema only (½ day)
- One migration: `flow` schema + tables in §2 + RLS in §4 + register the app.
- Add `'flow'` to known `app_id` constants in `@thefibre/shared`.
- No UI yet. Verify with `psql` + a seed script.

### Step 2 — `apps/flow/` skeleton (½ day)
- Copy the `apps/meet/` skeleton (Next.js 15, server actions, layout, branding pull-in).
- Sidebar with: Dashboard / Flows / Tasks / Contacts.
- DNS: `flow.thefibre.app` → Vercel (same project pattern as Meet).
- Public sign-in page: reuse the email-OTP component from `packages/shared`.
- Version constant `v0.0.1` in `apps/flow/app/(app)/layout.tsx`.

### Step 3 — Flow Library + read-only flow view (1 day)
- List + create + draft flows. No builder canvas yet — JSON editor in a `<textarea>` is fine for the first iteration.
- Activate the app for the test workspace; verify `app_membership` gate works.

### Step 4 — Flow Builder canvas spike (2–3 days)
- React Flow (xyflow) spike. Drag/drop steps, connect transitions, edit gates in a side panel.
- Persists via existing CRUD; the canvas is a view, not the source of truth (the graph is in the DB).
- This is the highest-risk component — timebox it.

### Step 5 — Flow runtime (1–2 days)
- Add contact to flow (creates `flow_run`, snapshots version, fires `flow.run.started`).
- Manual "Move to next step" with gate-validation server action.
- Contact-detail tab in apps/web reads `/contacts/:personId/runs` and shows active flows.

### Step 6 — Tasks (1–2 days)
- Auto-create step default tasks + transition gate tasks on relevant events.
- My Tasks + Team Tasks pages.
- Per-contact tasks rendered on contact-detail.

### Step 7 — Contact action auto-completion (1 day)
- Cron job (Fly scheduled machine or Supabase pg_cron) scans recent activity for matches.
- Wire `fibre-meet.meeting.attended` and `the-thread.session.attended` triggers.

### Step 8 — Flow Board (1–2 days)
- Kanban-style view per flow. Drag a card to move (validates gate or prompts override + reason).

### Step 9 — Dashboard (1 day)
- My Flows / My Contacts in Motion / My Tasks panels.

### Step 10 — Reports + lifecycle + doc linking + bulk hygiene (1–2 days)
- Flow funnel SQL views + simple charts.
- Lifecycle state transitions with the prompt described in briefing §6.
- Document URL paste.
- Bulk task close.

**Rough total:** ~12–15 build-days for v1 as scoped. Compare with Meet v2 (~4 weeks of evenings).

---

## 7. Open items deferred to build time

- **Override + reason** when manually moving past an unsatisfied gate — UI affordance and where the reason is stored. Suggest a `flow_run_event.override_reason` table or a JSONB on the step-changed activity.
- **Notification preferences** UI — daily digest opt-in.
- **Reports query patterns** — likely materialised views; design once we have real data.
- **Flow Builder undo/redo** — the canvas spike should produce an answer.

---

## 8. What this plan does *not* do

- No platform schema changes *beyond* the `meet_team` → `team` rename in Step 0. Flow consumes existing platform primitives natively.
- No new auth, no new email infra, no new tenancy boundary.
- No backwards-compat shims — Fibre Flow is greenfield.
- No use of the cross-app entity-mapping layer (`app_entity_mapping` / `app_record_link`). That layer is for connecting *external* apps to Fibre; in-family apps consume platform tables directly.
- No premature abstractions for "future apps that need tasks/flows" — Flow owns its schema, full stop. Generalise later if a third app needs it.
