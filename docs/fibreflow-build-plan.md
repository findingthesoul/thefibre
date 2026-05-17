# Fibre Flow — build plan

*Companions: [`fibreflow-brief-v0.3.md`](fibreflow-brief-v0.3.md) · [`fibreflow-review.md`](fibreflow-review.md) · [`fibreflow-data-model.md`](fibreflow-data-model.md). Written 2026-05-17.*

> **Terminology note.** "Platform" = **The Fibre** (the core). Fibre Flow is a sibling app to Fibre Meet, built on Fibre's primitives.

This plan turns the 10-step scaffolding sketch in `fibreflow-data-model.md §6` into a concrete build sequence: commits, version bumps, parallel-agent batches, risk hotspots, seed data, and a v1.0 done-criteria. Decision lock from 2026-05-17: **one big v1.0**, meaning we don't release publicly until the full surface works end-to-end on realistic data. We still cut versions internally (v0.x.0) for traceability and so the sidebar footer reflects progress.

---

## 0. Pre-flight (Sjoerd to confirm before build starts)

- [ ] Read this doc and the three companions. Push back on anything before code lands.
- [ ] Confirm DNS will be `flow.thefibre.app` (mirroring `meet.thefibre.app`).
- [ ] Confirm Fibre Flow gets its own Vercel project (mirroring Meet/Thread), shared API on Fly, shared Supabase.
- [ ] Decide: should Flow be visible in the app switcher from day one (clearly marked "preview"), or hidden until v1.0 ships? Recommendation: **visible + marked preview** so you can use it as data accumulates.

---

## 1. Phase A — Platform prep (½ day)

**Goal:** `meet_team` → `team` rename lands cleanly on production. No Flow code yet.

### Commit A1 — rename migration
- New migration `<14-digit>_rename_meet_team_to_team.sql`:
  - `alter table public.meet_team rename to team;`
  - `alter table public.meet_team_member rename to team_member;`
  - Rename indexes, constraints, RLS policies to drop the `meet_` prefix.
  - **Keep `SECURITY DEFINER` predicate helpers** (v0.9.0 work) — adjust their internal table refs.
- Apply against Supabase remote. Verify with `psql`.

### Commit A2 — codemod
- `rg -l 'meet_team' apps/ packages/` → mechanical replace.
- Touch: `apps/api/src/routes/meet/*`, `apps/web/lib/api.ts`, `apps/meet/**/*`, `packages/shared/src/**`.
- `pnpm -r typecheck` must pass.

### Commit A3 — version bump + deploy
- Bump web `v0.10.1` (patch, no UX change) — touches `package.json` × 5, `apps/web/app/(app)/layout.tsx` VERSION, `CHANGELOG.md`.
- Deploy API to Fly, web + meet to Vercel.
- Smoke test: open Meet, view a team page, add a member, create a team-scoped meeting type. All work.

**Exit criteria for Phase A:** Meet works identically to before; `public.team` exists; no app-code references `meet_team`.

---

## 2. Phase B — Foundation (1 day)

**Goal:** Fibre Flow exists as a deployable shell with sign-in. No flow concepts yet.

### Commit B1 — register the app + DB schema
- Migration `<ts>_create_flow_schema.sql`: full §2 schema from `fibreflow-data-model.md` (10 tables + RLS).
- Insert `app` row: `('flow', 'fibre-flow', 'Fibre Flow')`.
- Add `'flow'` to `APPS` in `packages/shared/src/branding.ts`.
- Activate Flow membership for sjoerd@soul.com in the seeded workspace.

### Commit B2 — `apps/flow/` scaffold
- Copy `apps/meet/` structure → `apps/flow/`. Strip Meet-specific pages, keep:
  - `app/(app)/layout.tsx` with VERSION = `'v0.0.1'`, Flow sidebar (Dashboard / Flows / Tasks / Contacts).
  - `app/(public)/sign-in/page.tsx` reusing the OTP component.
  - `app/auth/callback/route.ts` (copy verbatim).
  - `lib/api.ts` with `X-App-ID: fibre-flow`.
- `package.json` with name `@thefibre/flow`.
- `next.config.mjs`, `tsconfig.json`, `vercel.json`.

### Commit B3 — DNS + Vercel + env
- Vercel project `thefibre-flow` pointing at `apps/flow`.
- `NEXT_PUBLIC_API_BASE_URL` etc. set (same as Meet).
- DNS: `flow.thefibre.app` CNAME → Vercel.
- Supabase Auth redirect URL added.
- Add Flow to the app switcher in `apps/web` and `apps/meet` topbars.

### Commit B4 — `pnpm -r typecheck && pnpm -r build` + ship v0.0.1
- Deploy. Sjoerd should be able to open `flow.thefibre.app`, sign in with OTP, see the empty Flow shell.

**Exit criteria for Phase B:** Flow shell live at `flow.thefibre.app`. Empty Dashboard, empty Flows list. Auth works.

---

## 3. Phase C — Definition layer (2–3 days, partly parallel)

**Goal:** an admin can define a flow (graph + gates + step defaults) via API and a minimal UI. No runtime yet.

### C1 — API routes (sequential, parent does)
- `apps/api/src/routes/flow/index.ts` mounting:
  - `GET/POST /flows`, `GET/PATCH /flows/:id`
  - `POST /flows/:id/versions`, `POST /flows/:id/versions/:vid/publish`
  - Steps/transitions/gate-task-templates as nested resources on a draft version.
- Use existing `userClient` + RLS, not service-role.
- Log full Postgres errors to stderr (per `feedback_api_logs_first` rule).

### C2 — Flow Library page (apps/flow)
- List flows, filter by scope + lifecycle.
- New-flow dialog → creates draft, redirects to editor.

### C3 — JSON-editor builder (intentional placeholder before canvas)
- Single-page editor for a draft version: name, description, then a `<textarea>` of JSON for the whole graph (steps + transitions + gate tasks + step defaults).
- Validate + save. Publish button toggles `flow.lifecycle = 'active'` and creates `current_version_id`.
- **Why a textarea first:** unblocks Phase D (runtime) without waiting on the canvas. Sjoerd seeds a few flows by hand. Canvas comes in Phase G.

**Parallel-agent opportunity:** C1, C2, C3 are disjoint files (api routes / library page / editor page) — well-suited to a 3-agent parallel batch *after* the parent ships a stub for each. Same rules as v0.3.0/v0.4.0 work.

**Version:** v0.1.0 after Phase C.

**Exit criteria for Phase C:** Sjoerd can paste a JSON flow definition (e.g. the Sales Flow from the briefing), publish it, and see it listed in the Flow Library.

---

## 4. Phase D — Runtime + activity wiring (2 days)

**Goal:** contacts can be put into a flow, moved through it, and step transitions are logged as activity events.

### D1 — Add contact to flow
- "Add to flow" action on the Flow Library detail page AND on `apps/web/contacts/[id]` (cross-app pull from Flow's API).
- Server action creates `flow_run` with `current_step_id = entry step`, `flow_version_id = current version`.
- Fires `flow.run.started` activity event (see `fibreflow-data-model.md §3`).

### D2 — Step-default task materialisation
- On run creation AND on every step transition, materialise `step_default_task` templates into real `task` rows.
- Resolve `default_assignee_role` to a concrete `user_id` (owner of run, or first team member).

### D3 — Manual step transition
- "Move to next step" on the run-detail page.
- Validates the chosen transition's gate:
  - For each `gate_task_template`, check whether the corresponding `task` is `done` (personal/team) or whether a matching contact-action activity exists (contact).
  - If `gate_logic = 'all'` and any required task is open → block (with override + reason input).
  - If `gate_logic = 'any'` and at least one required task is done → allow.
- On success: update `current_step_id`, write `flow.run.step_changed` activity.

### D4 — Contact-detail tab in apps/web
- Per-app tab "Fibre Flow" emerges when a contact has a `flow_run` (same emergent-tabs pattern as Meet).
- Shows: active flows + current step + next gate tasks; history of completed runs.

**Version:** v0.2.0.

**Exit criteria for Phase D:** Sjoerd can add a contact to the Sales Flow, complete tasks, click "Move to next step", and watch them advance. Activity log shows the trail.

---

## 5. Phase E — Task system + dashboards (2 days, parallel-friendly)

**Goal:** the to-do experience is real.

Three independent surfaces — ideal parallel batch after parent stubs each page:

| Agent | Owns                                             |
| ----- | ------------------------------------------------ |
| E-a   | `apps/flow/app/(app)/tasks/page.tsx` — My Tasks  |
| E-b   | `apps/flow/app/(app)/tasks/team/page.tsx` — Team Tasks |
| E-c   | `apps/flow/app/(app)/page.tsx` — Dashboard (My Flows + Contacts in Motion + My Tasks card) |

API endpoints (parent ships before fanning out):
- `GET /flow/tasks?assignee=me&status=open` (cursor-paginated)
- `GET /flow/tasks?team=:id`
- `PATCH /flow/tasks/:id` (status, completion).

Manual task creation in this phase too (dialog reused across pages).

**Version:** v0.3.0.

**Exit criteria for Phase E:** opening `flow.thefibre.app` lands on a dashboard with real, useful information.

---

## 6. Phase F — Contact action auto-completion (1 day)

**Goal:** Fibre Meet meetings and Thread sessions close contact gate tasks automatically.

- Background job (Fly scheduled machine, every 10 minutes is fine for v1):
  - Scan recent `public.activity` events with `app_id in ('meet','thread')` and known `type`s.
  - For each, find open contact-actor tasks where `gate_task_template.contact_action_type` matches and `person_id` matches.
  - Mark task `done`, write `flow.task.completed` activity.
- Smoke-test: book a Meet for an enrolled contact, observe their flow run advances.

**Version:** v0.4.0.

**Exit criteria for Phase F:** the cross-app loop closes — Meet activity feeds Flow gates without manual logging.

---

## 7. Phase G — Flow Builder canvas (3–4 days, single-track)

**Goal:** replace the JSON textarea with a real drag-and-drop canvas.

This is the highest-risk component. Single-track, no parallel agents — design fidelity matters and shared state is everywhere.

### G1 — Spike (½ day)
- Try React Flow (xyflow). Render steps as nodes, transitions as edges. Persist nothing yet.
- Decision point: continue with React Flow, or fall back to a simpler form-based "step list + transition list" UI? Sjoerd reviews the spike.

### G2 — Read-only canvas (1 day)
- Render an existing published flow on the canvas. No editing. Lay out by stored `canvas_x` / `canvas_y` (or auto-layout if null).

### G3 — Step + transition editing (1–2 days)
- Drag a step to reposition (persists `canvas_x`/`y`).
- Side panel: edit step name/description/duration when selected.
- Draw a new transition between two steps; side panel for transition label + `gate_logic` + gate tasks.
- Add/remove steps via toolbar.
- Inline gate-task editor (title, actor_type, assignee_role, required toggle).

### G4 — Branching + end states + visual polish (½ day)
- Multiple outgoing transitions render with distinct colours.
- End states get the ✓/✗ marker.
- Validation: every flow must have exactly one entry step and at least one end state.

**Version:** v0.5.0.

**Exit criteria for Phase G:** Sjoerd can build the EBBF project-participation flow from §2 of the brief on the canvas, publish it, and run a contact through it.

---

## 8. Phase H — Flow Board (1–2 days)

**Goal:** kanban view of all contacts in a flow.

- One column per step. Cards sorted by `current_step_entered_at`.
- Card shows: contact name, organisation, time at step, next gate task.
- Drag a card to a new column → triggers transition with gate validation (same path as the "Move to next step" button from D3).
- Filter by owner, entry date, overdue.

**Version:** v0.6.0.

**Exit criteria for Phase H:** Opening a project flow shows all participants in one view with their current status.

---

## 9. Phase I — Lifecycle, hygiene, docs, reports (2 days, parallel-friendly)

Four independent slices for the final push:

| Agent | Owns                                                              |
| ----- | ----------------------------------------------------------------- |
| I-a   | Flow lifecycle states + the closing-prompt UX (`Closed`/`Archived`) |
| I-b   | Bulk task hygiene (legacy-task sweep page, bulk-close action)     |
| I-c   | Document linking (URL paste, attach to person/org/step/run)       |
| I-d   | Reports v1 (flow funnel, time at step, gate completion, activity volume) |

**Version:** v0.9.0 (one minor short of 1.0 — final polish round next).

---

## 10. Phase J — Hardening, seed data, v1.0 (1–2 days)

**Goal:** declare v1.0.

### J1 — Seed script (`apps/api/scripts/seed-flow.mjs`)
- Critical for "one big v1" — Sjoerd's stated reason for not phasing: needs real data to see how the interface functions.
- Builds on the existing EBBF seed.
- Creates 3 flows:
  - **Sales Flow** (workspace scope) — 3 contacts at various steps.
  - **Project Participation Flow** (team scope) — 5 contacts mid-journey.
  - **Partnership Flow** (personal scope) — 2 contacts.
- Materialises gate tasks (some open, some done, a couple overdue).
- Writes plausible activity events across 30 days.
- Idempotent.

### J2 — End-to-end manual test pass
- Run through every page on a clean session. Catch the dev-server-wedged-after-parallel-agents gotcha; restart `pnpm dev` between sessions.
- Verify GDPR erasure webhook handler works (`POST /api/v1/flow/erasure` — wired to platform's existing fan-out).

### J3 — Brief amendment + CHANGELOG
- Update `fibre-technical-brief-v0.4.md` with a §3 entry for Fibre Flow (positioning, what it owns).
- v1.0.0 CHANGELOG entry covering everything from B onwards.

### J4 — Cutover
- Remove the "preview" badge from the Flow tile in the app switcher.
- Announce.

---

## Risk register

| Risk                                                                                             | Mitigation                                                                                                    |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Canvas (Phase G) takes longer than 4 days — graph editors always do                              | The JSON-textarea editor (C3) ships from day one as the fallback. Don't block the runtime on the canvas.     |
| `meet_team` → `team` rename breaks something subtle in Meet                                       | Smoke-test all Meet team flows before merging Phase A. Bump web v0.10.1 as a checkpoint before Flow starts. |
| Activity-driven gate auto-completion misfires (closes the wrong task)                            | Strict matching on `(person_id, contact_action_type)`. Log every match. Manual override always available.    |
| "One big v1" tempts scope creep                                                                  | The v0.x version bumps after each phase are real ships internally; if Sjoerd uses them, scope stays honest.  |
| Dev-server wedge after parallel-agent batches (per CLAUDE.md gotcha)                             | Kill + restart `pnpm dev` after every parallel batch — same rule as v0.3 / v0.4 work.                        |
| Curator-data fields for Flow (review §1: `default_assignee_user_id`, `intro_source_note`)        | Defer to Phase J — only add if real usage shows a need.                                                       |

---

## Estimated total

| Phase | Description                                  | Time          |
| ----- | -------------------------------------------- | ------------- |
| A     | `meet_team` → `team` prep                    | ½ day         |
| B     | App shell + DNS + sign-in                    | 1 day         |
| C     | Definition layer (API + library + JSON editor) | 2–3 days    |
| D     | Runtime + activity wiring                    | 2 days        |
| E     | Tasks + dashboard                            | 2 days        |
| F     | Contact-action auto-completion               | 1 day         |
| G     | Flow Builder canvas                          | 3–4 days      |
| H     | Flow Board                                   | 1–2 days      |
| I     | Lifecycle + hygiene + docs + reports         | 2 days        |
| J     | Seed + hardening + v1.0 cutover              | 1–2 days      |
| **Total** |                                          | **~16–20 days** |

Realistic calendar window if Sjoerd is doing this in evenings + parallel-agent help: **3–4 weeks**. Mirrors Suite v2 → Fibre Meet's pace.

---

## Order of recommendation

1. Sjoerd reads this doc + the three companions, pushes back where needed.
2. We do Phase A together (the `meet_team` rename) — small, fast, no Flow code yet, validates the principle.
3. Phase B in one focused session — Sjoerd should see `flow.thefibre.app` live with sign-in at the end.
4. Then the rhythm settles: one phase per session, internal version bump each time, parallel-agent batches where called out.
5. v1.0 lands when Phase J is green — not on a date.
