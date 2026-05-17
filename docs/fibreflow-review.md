# Fibre Flow — Review against the v0.4 platform brief

*Companion to [`fibreflow-brief-v0.3.md`](fibreflow-brief-v0.3.md). Written 2026-05-17 against the platform at v0.10.0.*

> **Terminology note.** Throughout this doc, "the platform" means **The Fibre** (the core: identity, contacts, organisations, teams, workspaces, activity, auth). Fibre Flow is an **app** that consumes Fibre's concepts — the same way Fibre Meet does. There is no "Fibre Flow platform"; Flow sits on top of The Fibre alongside its siblings.

This is a gap analysis: what fits the existing architecture cleanly, what conflicts, what's already built and can be reused, and concrete answers to the briefing's seven open questions.

---

## 1. How Fibre Flow fits the data wall

The v0.4 brief (§2 + §5 Domain 5 + §13) draws a hard wall:

- **Platform owns:** identity, contact graph, activity events, enrolment state, consent.
- **Each app owns:** its own private content **and** the curator-data fields it justifies on persons/orgs (rows in shared tables tagged with `app_id`).
- **Apps cross the wall via:** the `activity` event log (type + subject, never body).

Fibre Flow slots in as a fourth delivery app:

| Concept in briefing       | Where it lives                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| Flow / Step / Transition / Gate / Gate-task definitions | **App-owned**, in a `flow` schema (private to Fibre Flow). Templates.        |
| Contact's position in a flow (`flow_run`, current step) | **App-owned**, in `flow` schema. References `person.id` from platform.       |
| Tasks generated from gates                              | **App-owned**, in `flow` schema. Reference `person.id`, `user.id`, `app_id`. |
| Step transitions, gate task completions                 | **Cross-wall:** written as platform `activity` events (type + subject).      |
| Fibre Meet meeting → contact action trigger             | **Read** from platform `activity` table where `app_id = fibre-meet`.         |
| The Thread session attendance → contact action trigger  | **Read** from platform `activity` where `app_id = the-thread`.               |
| Per-contact "stance / readiness / source" extra fields  | **Curator data:** rows in `person_app_profile` with `app_id = fibre-flow`.   |

This is exactly the pattern Meet, Thread, and Sales already follow. **No platform schema changes are required to ship Fibre Flow.**

---

## 2. Conflicts and frictions

### 2.1 "Personal flows" + workspace data wall

The brief allows **personal** flows that only the owner sees. Today's RLS on the platform tables is workspace-scoped with per-resource `visibility` on Meet-style resources (`members_only` / `org_wide`). Fibre Flow's `flow` table will need an explicit `owner_user_id` + a `scope` column (`personal` / `team` / `workspace`) and matching RLS predicates. The model already exists for `meet_team` — copy it. (See `permission-tiers-proposal.md` and v0.9.0 work.)

### 2.2 Teams: generalise at the platform level *(decided 2026-05-17)*

Briefing §3 / §8 talk about "a defined team". `meet_team` exists today as a Meet-private table.

**Decision:** rename `meet_team` → `team` (and `meet_team_member` → `team_member`) at the platform level *before* Fibre Flow code lands. Rationale: Fibre Flow is built from scratch on the same foundation as Meet — it consumes platform primitives natively, not through the cross-app entity-mapping layer. That mapping layer is for connecting *external* apps to Fibre; in-family apps share the platform's structures directly.

This is a single migration + codemod across `apps/api`, `apps/web`, `apps/meet`. Schedule it as a preparatory step in the build plan.

### 2.3 Contact-as-actor tasks vs append-only activity (§13 rule 5)

A "contact task" is logged retroactively ("we record that the contact signed the contract"). This must be written as an `activity` row, never as a mutation of an earlier row. The gate-task completion record itself lives in `flow` schema; the *outward signal* is an activity event with `type = 'flow.gate_task.contact_action'` and the contact's `person_id` as subject.

### 2.4 Document linking

Briefing §5.8 wants attaching Google Docs URLs to **contacts** and **organisations**. Today, only Meet attaches docs (to meeting bookings). Two options:

- Fibre Flow owns its own `flow_document_link` (private). Contact-detail page in apps/web composes per-app document blocks — same emergent-tabs pattern as profile data.
- Platform grows a generic `document_link` table tagged by `app_id`. More work; same outcome.

Recommend **app-owned** for v1.

### 2.5 "Workspace" terminology *(decided 2026-05-17)*

Briefing §3 uses **workspace** for the org-wide flow scope. The platform also uses **workspace** for the tenancy boundary.

**Decision:** keep the platform's vocabulary as-is throughout Fibre Flow — no renaming in UI or data model. "Workspace", "team", "person", "organisation" carry their platform meanings everywhere in the family. If inconsistencies surface during build, flag them rather than silently inventing new names.

### 2.6 The Flow Builder canvas is genuinely new

Nothing in the existing codebase resembles a drag-and-drop graph editor. This is the highest-risk component. Spike with React Flow (xyflow) or rete.js before committing the design. The data model (next doc) keeps the graph **declarative** so the canvas is a view, not the system of record — that's the right call.

---

## 3. What's already built that Fibre Flow reuses

| Existing piece                                                      | Reuse                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `person`, `organisation`, `org_membership`                          | Direct FKs. Read via platform API with `X-App-ID: fibre-flow`.                 |
| `workspace_member` + `relationship_type` + per-resource `visibility`| RLS pattern for `flow.scope` and `flow.visibility`.                            |
| `activity` log                                                      | Source of contact-action gate triggers; sink for transition + task events.    |
| `app` + `app_membership`                                            | Register `fibre-flow` as an app; gate per-user access.                         |
| `app_entity_mapping` + `app_record_link`                            | If Fibre Flow ever links its tasks/flows to external systems, this is ready.  |
| `branding.ts` (`@thefibre/shared`)                                  | App name, email signoff, footer — single source of truth.                      |
| Magic-link / OTP sign-in + `custom_access_token_hook`               | No new auth work.                                                              |
| `person_app_profile` / `org_app_profile` (Domain 5)                 | Optional Flow-specific fields (e.g. `default_assignee_id`, `intro_source`).   |
| `apps/meet` scaffolding pattern                                     | Template for `apps/flow` (Next.js 15, server actions + API, Resend, layout).  |

---

## 4. Answers to the seven open questions *(approved by Sjoerd 2026-05-17)*

| #  | Question                                                            | Recommendation                                                                                                                                                                                                                       |
| -- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | Gate logic: all / any?                                              | **Configurable per gate.** `gate.logic ∈ {'all','any'}`, default `'all'`. Trivial column; the UI shows a toggle. Avoids retrofit later.                                                                                            |
| 2  | Flow versioning when contacts are in-flight                          | **Snapshot on entry.** `flow_run.flow_version_id` pins the contact to the version they entered. Editing a Draft creates a new version row; published versions are immutable. Same pattern as Stripe products / Github Actions.    |
| 3  | Contact in same flow twice                                          | **New `flow_run` row.** Don't reopen. History stays clean, reporting stays simple. UI can surface "previously in this flow" on the contact card.                                                                                  |
| 4  | Step-level default tasks (auto-created on entry)                     | **Yes.** `step.default_tasks` (JSONB or child rows). On entry, materialise into `task` rows with the right actor + assignee. This is what makes the flow feel alive on day one.                                                  |
| 5  | Team ownership: inherit or redefine?                                | **Reference `meet_team.id`** for v1. Defer the generalisation until a third app (Thread?) needs teams. Document this as a known coupling.                                                                                          |
| 6  | Notifications                                                       | **In-app for Phase 1**, with a per-user setting. Email for overdue task digest only (daily). Resend infra already in place via `@thefibre/shared`. Skip per-event email — drives noise.                                          |
| 7  | Google Drive depth                                                  | **Manual URL paste** for v1. Picker is OAuth scope creep, not worth it before validating usage.                                                                                                                                    |

---

## 5. GDPR posture

The v0.4 brief is strict (§6, §10):

- **Soft delete only** for personal data. Fibre Flow's `task`, `flow_run`, and any rows referencing `person.id` need `deleted_at`.
- **Cross-app erasure** (§10): the platform fires a webhook to each registered app when a person is erased. Fibre Flow must register an erasure endpoint that scrubs all `task.contact_id`, `flow_run.person_id`, and any free-text fields where PII may have leaked (task title, description).
- **Append-only activity**: transition + task completion events are immutable. Corrections = new row.
- **Data minimisation**: every Flow-specific person field must justify itself. Curator fields go in `person_app_profile` with `app_id = fibre-flow`. Likely just `default_assignee_user_id` and `intro_source_note` — most contact-shaped data already exists at platform level.

---

## 6. Scope reality check

Fibre Flow is the **biggest single app** in the family by surface area:

- Flow Builder canvas (drag-drop graph editor) — net new
- Flow Board (kanban) — net new
- Task system — net new
- Dashboard with three switchable views — net new
- Per-contact / per-org integrations — extends existing pages

For comparison, Meet at v2 is roughly: booking page + meeting types + teams + calendars + bookings list. Flow is bigger.

**Phasing decision (2026-05-17):** one big v1. Sjoerd: "Can only see how the interface functions once we actually have data to work with." Build the full surface end-to-end before shipping; staged release would mean staring at a half-empty flow board and learning nothing.

---

## 7. Recommendations to Sjoerd

1. **Approve the answers to §4 open questions** above, or push back item-by-item. Once locked, freeze the briefing as v0.4.
2. **Generalise `meet_team` → `team`** at the platform level *before* Fibre Flow ships, or accept the cross-app coupling. This is a 1-evening migration; better to do it now than after Flow has hundreds of FKs to `meet_team`.
3. **Decide phasing**: the briefing implies one big v1; the §6 phasing above ships value in week 1 of build. Suite-style "everything at once" probably right; clarify expectation.
4. **Reconcile naming**: "workspace" overload (§2.5). Pick one.
5. **Move Fibre Flow into the build-plan queue** with explicit priority vs the open items there (cutover, per-app curator labelling, cross-app entity doc).

No code changes required to *start* — the platform is ready. The next concrete step is the data model + scaffolding plan in [`fibreflow-data-model.md`](fibreflow-data-model.md).
