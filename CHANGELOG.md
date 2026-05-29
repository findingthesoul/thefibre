# Changelog

All notable changes to The Fibre. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [SemVer](https://semver.org/).

The displayed version comes from `apps/web/components/shell/sidebar.tsx`. Bump it whenever a change ships.

## [Unreleased]

## [0.13.27] — 2026-05-29 — Fibre Flow v0.6.0

### Fibre Flow — drag-a-contact-through-the-flow popup

Clicking a contact (on a flow's "Contacts in this flow" list, or on the
Contacts page) now opens a **popup that shows the whole flow** with the
person positioned on their current step:

- The person rides a **draggable token** on their current step card.
- Steps reachable from here **light up** as drop targets; the current step's
  outgoing edge animates.
- **Drag the token onto a reachable step** → a **confirmation popup** runs the
  gate check: if satisfied, confirm and move; if not, it lists the step's gate
  tasks with one-click complete (the gate re-evaluates live) or an override
  reason to move anyway.
- Moving fires the same activity events as before; the popup refreshes to show
  the person on their new step.

Intuitive runtime — no buttons, you literally drag the person forward. The
button-based `/runs/[id]` full view is still available via "Full view".

### Added
- `apps/flow/app/(app)/flows/[id]/run-modal.tsx` — React Flow read-only graph
  with a draggable person token + confirm-move sub-popup.
- `apps/flow/app/(app)/contacts/contacts-list.tsx` — opens the modal from the
  Contacts page.
- `getRunDetail` server action.

### Changed — API
- `GET /flow/runs/:id` now also returns the run's full version `graph`
  (steps + transitions) so the popup can lay the flow out.

## [0.13.26] — 2026-05-29 — Fibre Flow v0.5.0

### Fibre Flow — drag-and-drop visual builder (Phase G)

The flow detail page now has a real **interactive canvas** (React Flow /
xyflow). No JSON needed:

- **Drag step cards** around a dotted grid; positions **snap** to 24px
  columns/rows and persist (`flow_step.canvas_x/canvas_y`).
- **Inline-edit a card's name** right on the card.
- **Click a card** → side panel to set kind (entry / normal / end ✓ / end ✗),
  description, expected duration, and the tasks auto-created when a contact
  enters that step.
- **Drag from a card's right edge to another's left** to create a transition;
  **click an arrow** → side panel for its label, gate logic (all / any), and
  gate tasks (title, actor type, contact-action type, required).
- **Add step**, delete step/transition, **Save** / **Publish** from the toolbar.
- Cards colour-coded by kind. Loop-backs render as curved edges.

The JSON editor is preserved under a collapsed **"Advanced — edit graph as
JSON"** disclosure for power edits / bulk paste.

### Added
- `apps/flow/app/(app)/flows/[id]/flow-canvas.tsx` — React Flow editor with
  custom step-card nodes + step/transition side panels.
- `@xyflow/react` dependency on `apps/flow`.

### Changed — API
- `PUT /flow/flows/:id/graph` now accepts + persists `canvas_x` / `canvas_y`
  per step (optional — the JSON editor omits them and still validates).

### Removed
- The read-only `flow-diagram.tsx` (superseded by the interactive canvas).

## [0.13.25] — 2026-05-29 — Fibre Flow v0.4.0

### Fibre Flow — visual flow diagram (Phase G, slice 1)

The flow detail page now renders the graph **visually**: steps as colour-coded
cards (entry = blue, end_positive = green ✓, end_negative = red ✗, normal =
white), transitions as labelled curved arrows with their gate summary
(`all 2` / `any 1`). Auto-laid-out into columns by longest-path depth from the
entry step; back-edges (loops) route below. Read-only for now — drag-to-edit
and in-canvas gate editing are the next slice; the JSON editor remains below
as the authoring surface in the meantime.

- `apps/flow/app/(app)/flows/[id]/flow-diagram.tsx` — hand-rolled SVG
  (no graph-library dependency, full design control). `foreignObject` for
  on-brand node/label typography.

## [0.13.24] — 2026-05-29 — Fibre Flow v0.3.0

### Fibre Flow Phase D — the runtime

Flows now *do* something: contacts can be put into a flow, their gate and
step tasks auto-materialise, and they move through steps with gate
validation. Step transitions and task completions write platform activity
events (type + subject only — across the data wall).

### Added — API (`apps/api/src/routes/flow.ts`)
- `POST /flows/:id/runs` — start a run for a person at the published version's entry step; materialises the entry step's tasks. Fires `flow.run.started`.
- `GET /flows/:id/runs` — runs in a flow (person + current step).
- `GET /runs` — all visible runs (Contacts "in motion" + dashboard); `?status=`.
- `GET /runs/:id` — run detail: current step, tasks, and available transitions each annotated with `gate_satisfied`.
- `POST /runs/:id/transition` — move along a transition. Validates the gate (all/any of the required gate tasks); blocks with `409 gate_unsatisfied` unless an `override_reason` is given. Cancels the old step's open generated tasks, materialises the destination step's tasks, fires `flow.run.step_changed` (or `flow.run.completed` at an end step).
- `POST /runs/:id/withdraw` — pull a contact out; cancels open tasks; fires `flow.run.withdrawn`.
- `PATCH /tasks/:id` — update/complete a task; completing a contact-actor task fires `flow.task.completed`.
- `GET /tasks` — caller's open tasks across flows (`?scope=mine|all`, `?status=`).
- `GET /contacts/:personId/runs` — a person's runs (for the future contact tab).

### Added — Flow frontend (`apps/flow`)
- **Flow detail → "Contacts in this flow"** — run list + Add-contact dialog (person search against the platform, start a run).
- **Run detail** (`/runs/[id]`) — current step, tasks with one-click complete/reopen (actor-type icons, gate badges), and "Move to next step" buttons that enable only when the gate is satisfied — with an inline override-reason flow when it isn't. Withdraw action.
- **My tasks** (`/tasks`) and **Contacts in motion** (`/contacts`) now wired to live data.

### Known limitation
- `can_see_person` (v0.9.0) has no "shares a flow_run" clause, so non-admin
  users can't yet see contacts solely because they're in a shared flow. Fine
  for the current admin-only workspace; a future migration adds the clause.

### Task-materialisation model
- Entering a step creates: that step's default tasks + the gate tasks on every
  transition leaving it. Leaving a step cancels its open generated tasks
  (manual tasks are preserved). Assignee resolves by actor type:
  personal→run owner, team→flow team, contact→the person.

## [0.13.23] — 2026-05-29 — Fibre Flow v0.2.0

### Fibre Flow Phase C — the definition layer

Flows can now be created, defined, versioned, and published. The visual
canvas is still deferred (Phase G); definitions are edited as JSON for now,
against the same underlying graph the canvas will later render.

### Added — API (`apps/api/src/routes/flow.ts`)
- `GET /api/v1/flow/flows` — list visible flows (RLS-scoped) with active-run counts; `?lifecycle=` / `?scope=` filters.
- `POST /api/v1/flow/flows` — create a draft flow + its first version.
- `GET /api/v1/flow/flows/:id` — flow metadata + the editable (or current) version's full graph, round-tripped by step `key`.
- `PATCH /api/v1/flow/flows/:id` — metadata + lifecycle (draft/active/closed/archived) + visibility.
- `PUT /api/v1/flow/flows/:id/graph` — replace the draft version's graph from JSON. Validates: unique step keys, exactly one `entry` step, ≥1 end step, transitions reference real keys, contact gate tasks require `contact_action_type`. Wipes + re-inserts steps/transitions/gates/defaults atomically per draft.
- `POST /api/v1/flow/flows/:id/publish` — publish the draft (must be non-empty), set `current_version_id`, flip lifecycle to `active`. Published versions are immutable; editing a published flow clones a fresh draft (version N+1).
- `DELETE /api/v1/flow/flows/:id` — soft delete.

### Added — Flow frontend (`apps/flow`)
- **Flow Library** (`/flows`) — list with lifecycle chips, scope, active-run count; empty state; "New flow" dialog (Personal / Workspace; team scope deferred pending a team picker).
- **Flow detail + JSON editor** (`/flows/[id]`) — edit the graph as JSON with a starter template, inline schema crib, Save draft / Publish, and full API error surfacing in the banner (per the read-the-error rule).

### Notes
- All flow routes run through `userClient(jwt)`; RLS enforces workspace +
  `has_app_membership('fibre-flow')` + scope/visibility. No service-role.
- Flow's user-facing version → **v0.2.0**.

## [0.13.22] — 2026-05-29

### Fix: theme / sidebar preferences now persist across sessions (Safari)

Theme and sidebar-mode choices were written client-side via
`document.cookie`. Safari's ITP caps **all** JavaScript-set first-party
cookies to a 7-day lifetime regardless of the requested max-age, so the
preference silently reverted. The cookies were already host-only (no
`domain`), so per-app isolation was fine — it was persistence that broke.

### Changed
- New `lib/prefs-actions.ts` Server Action (`savePref`) in web, meet, and
  flow. Writes `thefibre.theme` / `thefibre.sidebar` from the server via
  `Set-Cookie` (1-year max-age, host-only, `sameSite=lax`, not httpOnly so
  the no-flash `ThemeScript` can still read it). Server-set cookies aren't
  subject to Safari's 7-day script-cookie cap.
- `user-menu.tsx` (all three apps) now calls `savePref` instead of writing
  `document.cookie`. Theme still applies instantly client-side via
  `applyTheme()`; sidebar awaits the save before `router.refresh()` so the
  server layout re-reads the new value.
- Each app keeps its own preference (host-only cookie, per subdomain) —
  Meet can be dark while Flow is light.

## [0.13.21] — 2026-05-29

### Fix: returning to `thefibre.app` while signed in looked like a logout

After signing in and visiting `meet`/`flow`, navigating back to
`thefibre.app` showed the marketing landing page with a sign-in link —
appearing as if the session had dropped. It hadn't: cross-subdomain SSO
was working (the `.thefibre.app` cookie is shared, which is why meet/flow
stayed logged in). The root page (`apps/web/app/page.tsx`) just rendered
the public landing page **unconditionally**, with no auth check — unlike
meet/flow, whose root pages redirect signed-in users to `/dashboard`.

### Changed
- `apps/web/app/page.tsx` is now an async server component that calls
  `getUser()` and `redirect('/dashboard')` for authenticated users,
  mirroring meet/flow. Signed-out visitors still get the marketing page.

### Also
- Bundle analysis confirmed `NEXT_PUBLIC_COOKIE_DOMAIN=.thefibre.app` is
  correctly baked into all three frontends — the cookie scope was never
  the issue.

## [0.13.20] — 2026-05-20 — Fibre Flow v0.1.0

### Fibre Flow lands as the fourth in-family app (Phase B)

The platform's fourth sibling app — alongside Meet, Thread, and the
gated Sales / Learn slots. Sales pipelines, project intakes, partnership
arcs, anywhere a contact moves through a sequence over time. Conceptual
spec: [`docs/fibreflow-brief-v0.3.md`](docs/fibreflow-brief-v0.3.md).
Build plan: [`docs/fibreflow-build-plan.md`](docs/fibreflow-build-plan.md).

Phase B closes Phase A (the `team` rename) and delivers the shell.

### Added

- **Schema** — nine new tables under `public.flow_*`:
  `flow_definition`, `flow_version`, `flow_step`, `flow_transition`,
  `flow_gate_task`, `flow_step_default_task`, `flow_run`,
  `flow_task`, `flow_document_link`. Workspace + has-app-membership
  RLS, mirroring the v0.9.0 Meet pattern. No platform schema changes —
  Flow consumes `person`, `organisation`, `team`, `workspace`,
  `activity`, `app_membership` natively. Migration
  `20260520120000_fibre_flow_schema.sql`.

- **`fibre-flow` app registered** in `public.app` (slug constraint
  widened to include it). Branded via
  `packages/shared/src/branding.ts`.

- **`apps/flow/` skeleton** at `flow.thefibre.app` (Vercel project
  + DNS land in Phase B3). Sidebar: Home / Flows / Tasks /
  Contacts / Settings. Empty-state placeholders for the four content
  pages — visible end-to-end so Sjoerd can see the shape before the
  engine fills in. Phase B's job is to be empty-on-purpose.

- **`fibre.app.json` manifest** declaring Flow's scopes
  (read persons/orgs/activities, write activities) and the five
  activity types it will emit: `flow.run.started`,
  `flow.run.step_changed`, `flow.run.completed`,
  `flow.run.withdrawn`, `flow.task.completed`.

### Decisions baked in (per `docs/fibreflow-review.md` §4, locked 2026-05-17)

- `gate_logic` is configurable per transition (`'all'` | `'any'`), default `'all'` (Q1)
- `flow_version` is snapshot-pinned per run; published versions are immutable (Q2)
- A contact re-entering a flow gets a new `flow_run` row (Q3)
- `flow_step_default_task` materialises into `flow_task` rows on step entry (Q4)
- `team_id` references `public.team` natively (Q5; Phase A enabled this)
- In-app notifications first; email digest later (Q6)
- Manual Google Drive URL paste in v1; OAuth picker later (Q7)

### Not yet shipped (intentional — comes in Phases C–J)

- The flow builder (Phase G), including a JSON-textarea fallback for
  Phase C.
- The runtime that moves contacts through flows (Phase D).
- The task system + dashboards (Phase E).
- Cross-app activity reading for contact-action gates (Phase F).
- Flow Board kanban view (Phase H).
- Lifecycle / hygiene / reports / docs (Phase I).
- Seed data + v1.0 cutover (Phase J).

## [0.13.19] — 2026-05-19

### Reserved-slug validation on host / team / meeting-type

Until now nothing stopped a host from claiming the slug `settings` —
the resulting URL `meet.thefibre.app/settings` would match Meet's
`(app)/settings` route group instead of `[hostSlug]`, and the host
would be silently unreachable. Same hazard for `meeting-types`,
`teams`, `dashboard`, `confirmed`, `auth`, etc.

Now denied at the API layer with a clean 400 + field error.

### Added
- **`apps/api/src/lib/reserved-slugs.ts`** — single source of truth:
  - `TOP_LEVEL_ROUTES` — `auth`, `invite`, `no-access`, `sign-in`,
    `signup`, `login`, `app`.
  - `APP_GROUP_ROUTES` — `bookings`, `contacts`, `dashboard`,
    `internal-team`, `meeting-types`, `organisations`, `persons`,
    `programmes`/`programs`, `settings`, `teams`.
  - `MT_SUBPATHS` — `confirmed`, `cancel`, `reschedule`.
  - `INFRA` — conventional SaaS reserves: `api`, `admin`, `about`,
    `brand`, `callback`, `docs`, `faq`, `health`, `help`, `legal`,
    `oauth`, `privacy`, `pricing`, `public`, `robots`, `status`,
    `support`, `terms`, `webhook`(s), `www`.
- **`SLUG_PATTERN`** regex — lowercase alnum + hyphens, no leading/
  trailing hyphen.

### Changed
- **`HostUpdate.slug`**, **`MeetingTypeUpsert.slug`**, **`TeamUpsert.slug`**
  in `apps/api/src/routes/meet.ts` now go through `SLUG_PATTERN` +
  `isReservedSlug` refinement. Error messages name the issue
  ("reserved word — would collide with a Meet route") and list a
  preview of reserved values.

### Notes
- The DB has no `CHECK` constraint mirroring the list — slugs are
  validated at the API boundary only. Adding a generated-column
  constraint would couple DB to UI route names; an API-layer check
  is the right scope.
- Web-side: the existing `name-slug.tsx` widget normalises input to
  lowercase + hyphen, so the regex piece is already enforced
  client-side; the reserved-word check is the only new server-only
  rule. Web caller still sees the clean field error in dialogs.

## [0.13.18] — 2026-05-19

### Platform Billing Phase 1 — plan-aware Meet skim

Schema + free-by-default + plan-aware Meet fee. The 2%/€2 cap on paid
Meet bookings is no longer hard-coded — it reads the workspace's plan.
Free pays the skim; Pro / Org pay 0%, as decided in
[`docs/platform-billing-roadmap.md`](docs/platform-billing-roadmap.md).
Phases 3 + 4 (upgrade UI, Stripe Checkout for subscriptions) are
deferred — they need Sjoerd to configure Products in Stripe first.

### Added (Phase 1)
- **Migration `20260519100000_platform_billing_phase1.sql`**:
  - `billing_plan` table seeded with the three tiers from the roadmap
    — Free (€0, 2%/€2 cap), Pro (€15/seat/mo, 0%), Org (€30/seat/mo, 0%).
    Features stored as JSONB (`first_party_apps`, `sso`, `audit_log`,
    `max_users`, `max_contacts`, etc.) so the UI can gate without code
    changes when we add a tier.
  - `workspace_subscription` table — FK to `workspace` and to
    `billing_plan`, status enum incl. `comped`, Stripe customer +
    subscription ids, billing interval, period boundaries, seat count.
    RLS: workspace members can read their own row; writes via
    service-role only (Stripe webhook handler in a later phase).
  - `workspace_meet_fee(ws_id)` SQL helper returning
    `(pct, cap_cents)` — the API reads this at Checkout time.

### Added (Phase 2)
- **Backfill** — every existing workspace gets a Free + `comped`
  row tagged `comped_reason = 'pre-billing default'`, so we never
  charge for legacy data.
- **Trigger `on_workspace_insert_create_subscription`** — every new
  workspace automatically gets a Free + comped row. UI never has to
  remember to create one.

### Changed (Phase 7)
- **`POST /api/v1/meet/public/bookings`** — the Connect Checkout
  Session's `application_fee_amount` now comes from
  `workspace_meet_fee` instead of the hard-coded `(2%, cap €2)`. Pro
  and Org workspaces send `application_fee_amount: 0` so the host
  keeps 100% of the booking revenue. Defensive default: if the
  lookup somehow fails, falls back to the Free rate (never under-
  skim).

### Added (UI hook)
- **`GET /api/v1/workspace-apps/billing`** — returns
  `{ plan, subscription }` for the current workspace. UI can use this
  to render a plan badge / upgrade prompt / gate Pro-only features.
  No UI consumer yet; landing it now keeps Phase 3 a 1-day build
  instead of 1.5.

### What's still out (Phases 3–8)
- Workspace billing page (`/settings/workspace/billing`)
- Stripe Checkout for upgrades + webhook lifecycle
- Feature gates calling `requirePlan(min)` from API endpoints
- Stripe Billing portal hand-off for invoice history / cancellation

These need a Stripe Products + Prices walkthrough in the dashboard
first — see [`docs/platform-billing-setup.md`](docs/platform-billing-setup.md).

## [0.13.17] — 2026-05-19

### API CORS goes from "any origin" to an allowlist

Until now the Hono CORS middleware reflected every Origin back ("any
origin is allowed"). With paid bookings, branded auth, and Stripe
webhooks all live in production, that was the last "we'll harden it
later" item on the post-deploy loop. Done.

### Changed
- **`apps/api/src/server.ts`** — CORS now allowlists:
  - The 5 prod subdomains: `thefibre.app`, `meet.thefibre.app`,
    `thread.thefibre.app`, `sales.thefibre.app`, `learn.thefibre.app`.
  - Local dev: `http://localhost:3000` / `:3001` / `:3002`.
  - Our own Vercel previews — regex match on
    `https://(thefibre-web|thefibre-meet|thefibre-thread)-<branch>.vercel.app`.
  - Anything in `CORS_ORIGINS` (comma-separated env override) for
    one-off staging hosts.
- Unknown origins receive **no `Access-Control-Allow-Origin` header**
  at all. The browser then blocks the cross-site request as the spec
  requires. We deliberately don't reflect-and-allow because
  `credentials: true` + `*` would have been rejected by browsers
  anyway, and we want a clean deny rather than a noisy half-allow.
- Server-to-server callers (Stripe webhook, Supabase Send Email Hook)
  are unaffected — no `Origin` header, no CORS handshake.

### Operations note
- For any extra preview / staging origin Sjoerd wants to whitelist
  without redeploying: `fly secrets set CORS_ORIGINS="https://extra.example.com" -a thefibre-api`.
  Restart picks it up.

## [0.13.16] — 2026-05-18

### The Fibre wordmark in the platform sidebar

Until now the handwritten "the fibre" wordmark lived only in the
auth emails (BRAND_ASSETS.logoUrl, v0.10.0). Inside the platform
the sidebar showed plain text "The Fibre". This brings the brand
into the app shell — same asset, same SPoT.

### Changed
- **`apps/web/components/shell/sidebar.tsx`** — when the sidebar is
  expanded, the brand label is now the wordmark image (`/brand/the-fibre.png`)
  instead of plain "The Fibre" text. The compact yellow "tf" tile stays
  exactly as it was — it's the anchor when the sidebar is collapsed and
  doesn't depend on image loading.
- Meet sidebar untouched. Meet shows "Fibre Meet" specifically — the
  Fibre wordmark belongs on the platform shell where it represents
  the umbrella brand.

### Also
- **Build-plan cleanup.** The "Group / One-off / Meeting poll event
  types" entry is marked done — Group shipped in v0.11.1, the other
  two in v0.12.0. The stale entry was misleading me earlier today.

## [0.13.15] — 2026-05-18

### Verified-domain auto-attribution

The promised follow-up to v0.13.14. When a new person is created with
an email whose domain matches a verified organisation in the workspace,
we now auto-link them via `org_membership` (as primary, since brand-new
persons have no existing primary). Plus a backfill endpoint to retro-
link existing contacts after an org's domain is verified.

### Added
- **`POST /api/v1/persons/` auto-link.** On person create, looks up
  `organisation` rows in the workspace where `domain` matches the
  email's domain (case-insensitive) and `domain_verified_at IS NOT
  NULL`. On a match: inserts an `org_membership` row with
  `is_primary: true` and stamps an audit activity row.
  - The response now includes `auto_linked_org_id` (nullable) so
    callers can react in the UI.
  - The activity row's subject reads
    `"Added <Name> to the workspace · auto-linked to <Org> (verified domain)"`.
- **`POST /api/v1/organisations/:id/domain-verification/backfill`**
  — re-scans all persons in the workspace whose email matches the
  org's verified domain, inserts an `org_membership` for each that
  isn't already linked. `is_primary` is set only when the person
  has no other active primary (doesn't fight existing curation).
  Returns `{ linked, skipped, total }`. Idempotent: re-running just
  reports 0 new links.
- **"Link existing contacts on this domain" button** on the org
  overview, shown once the domain is verified. Calls the backfill
  endpoint and renders the count inline.

### Safe by design
- **Verification is the gate.** Unverified domains are ignored, so
  a typoed/squatted org domain can't auto-attribute strangers.
- **Audit trail.** Every auto-link writes an activity row, so an
  admin can see exactly where a contact's org link came from and
  end the membership if it's wrong.
- **No PATCH-time auto-link.** Updating an existing person's email
  doesn't trigger auto-attribution — keeps behaviour predictable
  and avoids surprise re-links when emails change.

## [0.13.14] — 2026-05-18

### Org branding + DNS-based domain verification

Sjoerd: "branding is missing" and "setting for a DNS for an org with a
domain name is missing". Both addressed in one slice — org logo + a
TXT-challenge verification flow for the org's claimed domain.

### Added
- **Org logo on the profile header.** `logo_url` (already a column on
  `organisation`) is now editable from the org edit dialog and renders
  as a 48px avatar to the left of the org name on every org-detail
  surface (Overview / Profile / per-app tabs). Falls back to a letter
  tile when unset.
- **`PageHeader` now supports a `leading` slot** — the avatar/logo
  slot. Generic enough that contact profiles can use the same pattern
  later.
- **DNS verification panel** on the org overview (visible when a
  domain is set). Three states: no challenge issued, in-flight (shows
  the TXT name + value with copy icons + Check button), verified
  (green chip + "Re-verify" link).
- **Migration `20260517270000`** — adds `organisation.domain_verified_at`
  and a new `org_domain_verification` table holding the one-time TXT
  challenge per org. RLS scoped to workspace_member.
- **Three API endpoints**:
  - `GET    /api/v1/organisations/:id/domain-verification` — current
    state (domain, verified-at, in-flight challenge if any).
  - `POST   /api/v1/organisations/:id/domain-verification` — generate
    or rotate a challenge. Returns `record_name` + `record_value`.
  - `POST   /api/v1/organisations/:id/domain-verification/check` —
    `dns.resolveTxt(_fibre-verify.<domain>)` and compare. On match:
    stamps `domain_verified_at`.
- **OrgUpdate schema** now accepts `logo_url`.

### Honest gaps
- **Logo upload is URL-only.** No file upload to Supabase Storage yet —
  paste a public PNG/JPG/SVG URL. The "upload" UI is a follow-up
  (probably aligned with workspace branding when we get there).
- **No follow-on auto-attribution.** Verified domains don't yet auto-
  link new persons whose email matches `@<domain>` to the org. The
  trust signal is there; the wiring is the next slice.
- **Workspace-level branding** (the Fibre app shell wordmark in topbar
  / sidebar) is still untouched. The hand-written wordmark lives in
  emails only; the sidebar shows the 2-letter brand tile. Worth a
  separate decision before changing.

## [0.13.13] — 2026-05-18

### Platform prep: rename `meet_team` → `team` (Phase A of Fibre Flow build)

Teams are a Fibre primitive, not a Meet-private one. Sibling apps (Fibre
Flow next) consume teams natively, so the table moves out of Meet's
namespace. See [`docs/fibreflow-review.md` §2.2](docs/fibreflow-review.md)
and [`docs/fibreflow-build-plan.md` Phase A](docs/fibreflow-build-plan.md).

### Changed
- `public.meet_team` → `public.team`, `public.meet_team_member` →
  `public.team_member`. Indexes, triggers, and policies renamed in place
  (FK constraints follow by OID).
- `public.can_see_person` and `meet_booking_visibility` policy bodies
  refreshed so their canonical source text uses the new names.
- `public.meet_is_team_lead` body refreshed; function name kept for now
  (rename deferred — the `meet_` prefix is historical baggage we can
  drop in a later cleanup pass).
- `apps/api/src/routes/meet.ts` and `apps/meet/fibre.app.json` updated.

### Migration
- `20260517220000_rename_meet_team_to_team.sql`.

### Notes
- Four companion docs landed first: brief, review (with locked
  decisions), data model, full build plan. See
  [`docs/fibreflow-build-plan.md`](docs/fibreflow-build-plan.md).
- The `app_entity_mapping` seed row for `meet_team_member` is updated to
  `team_member`; the entry will likely be removed entirely in a later
  cleanup since team membership is now a platform concept and not a
  Meet app entity.

## [0.13.12] — 2026-05-17 — Meet 2.1.4

### Paid bookings now generate real VAT invoices

Sjoerd: "Is invoicing in?" Partly — billing fields (legal name, tax ID,
address) existed on persons + orgs, and Stripe Connect was wired for
paid bookings, but Stripe Checkout only emails its own receipt — that's
not a legal VAT invoice. EU customers need one. Now Stripe auto-generates
a finalised invoice for every paid booking, emails the hosted PDF link
to the invitee, and we surface it on the confirmation page.

### Added
- **`invoice_creation.enabled = true`** on the Connect Checkout Session
  in `POST /api/v1/meet/public/bookings`. Stripe creates a finalised
  Invoice (with the connected host's branding, tax ID, business address),
  emails a hosted PDF link to the invitee, and files it under the host's
  Invoices dashboard. No new tables, no new render code.
- **`billing_address_collection: 'required'`** — so the auto-generated
  invoice has a "Bill to" block, mandatory for EU reverse-charge VAT.
- **`invoice_data.description` + `metadata.booking_id`** stamped on the
  invoice so it traces back to the booking row.
- **Migration `20260517260000_meet_booking_invoice.sql`** — adds
  `stripe_invoice_id` and `stripe_invoice_url` (hosted PDF) to
  `meet_booking`. Both nullable; free bookings have neither.
- **Webhook capture** — `checkout.session.completed` now also
  `stripe.invoices.retrieve(session.invoice)` on the connected account
  and stashes `id` + `hosted_invoice_url` on the booking. Best-effort:
  a missing invoice doesn't block confirmation.
- **Confirmation page** (`/<host>/<mt>/confirmed/<id>`) — when
  `payment_status='paid'` and the invoice URL is present, shows a
  "View invoice (PDF) ↗" link beside the confirmation-email note.
  Graceful fallback copy when the host's connected account doesn't
  have automatic invoicing enabled yet.

### Also
- **User menu fix** (web + meet): the Profile and Settings entries
  were inert `<button>`s with no href/onClick. Both apps now route
  them to `/settings` (resp. `/settings/profile` on Meet) and close
  the menu on click. "Take a tour" stays as a muted placeholder.

### Honest gaps
- **No Stripe Tax.** Tax rates on the auto-invoice depend on the host
  enabling Stripe Tax inside their connected account. We don't force
  `automatic_tax: true` because the Session call would fail for hosts
  who haven't onboarded it — a regression risk for existing paid
  flows. Per-workspace opt-in once Platform Billing Phase 1 lands.
- **No Fibre Sales surface** — there's still no in-product way to
  issue arbitrary invoices (outside the Meet paid-booking flow). The
  `fibre-sales` app slug exists; the app doesn't.
- **Historical paid bookings** (pre-migration) won't have an invoice
  URL stamped. Stripe still has the invoice on the host's account —
  we just don't backfill the link.
## [0.13.11] — 2026-05-17

### Same dormant-membership fix on /settings (App access list)

v0.13.10 fixed the contact-profile surface. The `/settings` page
read from a separate endpoint (`/api/v1/auth/me`) and was still
listing all 5 apps as ADMIN while `/settings/apps` showed only Fibre
Meet activated.

### Changed
- **`GET /api/v1/auth/me`** now filters `memberships` to apps the
  workspace has activated in `workspace_app` (deactivated_at IS NULL).
  Sidebar app list, /settings App access section, and any other
  consumer of `me.memberships` now matches the workspace's active
  apps.
- **`fibre-platform` always included** in both endpoints
  (auth/me + persons/:id/memberships) — it's The Fibre itself,
  no workspace_app row exists for it, but the workspace-admin gate
  on /settings/apps reads `m.app.slug === 'fibre-platform' && m.role === 'admin'`,
  so dropping it would lock admins out of managing apps. Special-cased
  in code with a comment.

## [0.13.10] — 2026-05-17

### Fix: contact's "Apps they have access to" listed dormant memberships

Sjoerd: profile showed Fibre Meet + The Thread + Fibre Sales + Fibre
Learn + The Fibre — but the workspace's Settings → Apps page had
only Fibre Meet activated. The two pages contradicted each other.

### Changed
- **`GET /api/v1/persons/:id/memberships`** now joins `app_membership`
  with `workspace_app` (where `deactivated_at IS NULL`) and drops
  any app memberships for apps the workspace hasn't activated. So
  the profile's app-access chips match Settings → Apps.

### Note on the still-empty Organisations section
"No organisations linked yet" on Sjoerd's own profile is accurate —
there's no `org_membership` row connecting him to Solidarity Lab B.V.
The relationship exists conceptually (the workspace belongs to the
company) but the platform's contact-graph edge wasn't created. Fix
by opening the org page (e.g. /organisations/<solidarity-lab-id>) →
**Add member** → Sjoerd, with the appropriate title/role/dates.

## [0.13.9] — 2026-05-17

### Contact profile now shows org + workspace + app memberships

Sjoerd: "Sjoerd@soul.com is an org owner ... in Fibre I don't see
that in his profile (not the connection to the company, not his role
in the workspace, not the workspaces he is part of...). This should
be there no?" Yes — these are platform-owned facts (brief §2,
"platform owns identity + contact graph edges"). Now surfaced.

### Added
- **`GET /api/v1/persons/:id/memberships`** — returns
  `{ org_memberships, workspace_member, app_memberships, has_account }`.
  Org memberships include title, department, seniority, decision-
  maker / budget-holder / champion flags, primary org, and start/end
  dates. Workspace member shows role + relationship_type (internal /
  external). App memberships list which apps the person has a seat
  for (only if they hold a Fibre user account).
- **Contact overview page** gains two new sections between the
  identity fields and the timeline:
  - **Organisations**: cards per org membership with a "Primary"
    chip on the main one, "Ended" chip on historical roles, plus
    decision-maker / budget-holder / champion badges where set.
    Clicks into `/organisations/<id>`.
  - **Workspace access** (only when the person has a Fibre account):
    workspace name, role (admin/member), relationship_type (internal
    /external), and a row of app-name chips for the apps they hold.

### On Sjoerd's other question

**"Are contacts of an organisation shared between apps? That would
be meaningful."** Yes, already. The `person` and `organisation`
tables are platform-owned and workspace-scoped — every app with
`app_membership` in the workspace sees the same identity rows (RLS
on `person.workspace_id`). Apps own per-app *curator data* on top
(host notes in Meet, lead score in HubSpot) — those don't cross
the wall. So:

- Identity, contact details, **org memberships**, contact-graph
  relationships → all shared across apps in the workspace.
- Curator data → per-app, gated by that app's membership.

That's the brief §2 / §5 contract working as designed.

## [0.13.8] — 2026-05-17 — Meet 2.1.3

### Meet's contact tab finally shows what Meet actually justifies

Until now, the Fibre Meet tab on a contact profile rendered
change-facilitation fields (Role in change, Stance, Readiness,
Leadership style, Themes, Blockers, Motivators, Current challenge,
Facilitator notes). Those fields belong to a future Fibre Change
app, not to Meet. Per brief §5 ("the app justifies the field"),
Meet should only persist what it has a reason to.

### Changed
- **Migration `20260517250000_meet_person_profile.sql`** — new
  `person_meet_profile` table: workspace_id+person_id PK, host_notes
  (private text), vip + blocked flags, invitee_timezone. RLS scoped
  to fibre-meet membership.
- **New `GET /api/v1/persons/:id/meet`** returns
  `{ profile, upcoming_bookings, past_bookings }`. Bookings are live
  from `meet_booking`, matched by `invitee_email`.
- **New `PATCH /api/v1/persons/:id/meet`** upserts the profile.
- **GET `/api/v1/persons/:id/apps`** now also lists `fibre-meet`
  when a person has any `meet_booking` against their email — so the
  tab appears even before any curator data exists.
- **Web `apps/web/app/(app)/contacts/[id]/app/[appSlug]`** branches
  for `appSlug === 'fibre-meet'` and renders `<MeetTab>` instead of
  the generic curator layout.
- **New `MeetTab`** (`contacts/[id]/meet/tab.tsx`) renders:
  - Meet profile card with status chips (VIP / Blocked), preferred
    timezone, host notes, total-meeting count
  - Upcoming meetings list (live)
  - Past meetings list (live)
- **New `MeetProfileEdit`** dialog — clean, Meet-only fields. Title
  reads "Edit Meet profile — Fibre Meet" matching the app-chip
  convention from v0.10.1.

### Honest gaps
- The old `person_change_context` table is left in place. No data
  loss; just no longer surfaced on the Meet tab. Drop is a separate
  migration once you confirm no workspace relies on it.
- The Meet manifest still references `person_change_context` as a
  curator field for backward compat. Updating that is part of the
  table-drop follow-up.
- Booking rows on the contact page aren't clickable into a dialog
  here (that lives in Meet). For deeper inspection users click
  through to the meeting in Meet.

## [0.13.7] — 2026-05-17 — Meet 2.1.2

### Fix: paid MT silently reverted to Free on save

Native `<input type="radio">` with no `value` attribute posts the
literal string `"on"` for whichever radio is checked. The Pricing
free/paid radios were unattributed — so both posted
`pricing_visible: 'on'`, the action's `!== 'paid'` branch always
fired, and `price_cents` was nulled out on every save. Then the
form re-rendered with no price and the chooser jumped back to
"Free".

### Changed
- **`apps/meet/app/(app)/meeting-types/form.tsx`** — Pricing radios
  gain `value="free"` / `value="paid"`.
- **`apps/meet/app/(app)/meeting-types/actions.ts` `bodyFromForm`**
  now reads the existing hidden `pricing_mode` input (mirrors React
  state directly) as the authoritative source, falling back to
  `pricing_visible`. Belt-and-braces so a future radio regression
  can't wipe prices again.

## [0.13.6] — 2026-05-17 — Meet 2.1.1

### Fix: Payments page saved silently but UI showed old value; settings cards spaced

### Changed
- **`apps/meet/app/(app)/settings/actions.ts`** — `updateHost`
  revalidatePath list now includes `/settings/payments`. Previously
  pasting `acct_…` and clicking Save flipped the row in DB but the
  page re-rendered from cache, showing the field still empty.
- Same action now uses `formatApiError()` (matches the v0.12.3
  pattern) so any future zod/RLS error appears inline instead of
  the bare "API 500".
- **API `PATCH /api/v1/meet/me`** logs full Postgres error + zod
  details + body keys on failure. Same diagnostic pattern as
  v0.12.2 for MT save.

### Settings cards — actual breathing room
- Settings page now renders cards in a **2-column grid with `gap-3`**
  instead of a single divided list. Each card is its own bordered
  surface with `p-5` and a slightly larger icon tile (`h-10 w-10`).
  The two sections (Personal / Workspace) separated by `mt-14`.

## [0.13.5] — 2026-05-17 — Meet 2.1.0

### Meet Phase 3: Stripe Checkout for paid bookings

A paid meeting type now redirects the invitee to Stripe Checkout
after they pick a slot. The booking sits as `payment_status='pending'`
until Stripe's webhook fires `checkout.session.completed`; then the
deferred side-effects (Google Calendar event, branded confirmation
email, activity row) run automatically.

### Added
- **`apps/api/src/lib/stripe/client.ts`** — lazy-loaded Stripe SDK.
  `stripeOrNull()` returns `null` when `STRIPE_SECRET_KEY` is unset
  so the API still boots in environments without Stripe configured.
- **Booking POST** detects paid MTs (`price_cents > 0`), creates a
  **Stripe Connect Checkout Session** against the host's connected
  account, and returns `{ booking, payment_required: true, checkout_url }`.
- **`payment_intent_data.application_fee_amount`** set to 2% capped
  at €2 per booking — the Free-workspace skim. Phase 7 will read the
  workspace's plan and waive this for Pro/Org once Platform Billing
  Phase 1 lands.
- **New `POST /api/v1/meet/stripe-webhook`** (public, HMAC-verified).
  Handles three events: `checkout.session.completed` (flip
  payment_status to 'paid', run side-effects), `checkout.session.expired`
  and `payment_intent.payment_failed` (cancel the booking).
  Idempotent — same session id is safe to receive twice.
- **`runConfirmationSideEffects(bookingId)`** helper centralises
  Calendar + email + activity logic. The approve endpoint refactored
  to call it; the webhook calls the same code so both paths produce
  identical state.

### Changed
- **Public booking page** (`/[host]/[mt]`) now shows the price in
  the sidebar (currency-localised) with "— paid at checkout".
- **Public booking flow** (`flow.tsx`) detects `payment_required`
  in the create-booking response and redirects to `checkout_url`
  via `window.location.href`.
- **Stripe webhook URL** registered in `apps/api/src/middleware/app-context.ts`
  PUBLIC_PREFIXES so the route bypasses JWT auth — signature is the
  trust mechanism.

### Honest gaps
- **Approval + payment combined**: a MT with both required is
  treated as paid-only (payment is the hard gate; approval is
  auto). If you want host-approval-then-pay, the combined flow is
  a Phase 3b follow-up.
- **No refund UI** yet — that's roadmap Phase 6.
- **Application fee is hardcoded at 2%/€2** (Free-workspace rate)
  for every booking because Platform Billing hasn't shipped. Once
  Platform Billing Phase 1 seeds `workspace_subscription`, the
  Meet POST reads the plan and applies 0% for Pro/Org.
- **Untested in prod** until `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
  are set on Fly per `docs/platform-billing-setup.md`. The code
  ships dormant; the API returns 503 with `code: 'stripe_not_configured'`
  on the create-booking path until then.

## [0.13.4] — 2026-05-17

### Booking email matches the auth-email visual; Google stops emailing invitees

### Changed
- **`apps/api/src/lib/email/templates.ts` shell rewritten** to use the
  same wordmark + footer pattern as the v0.10.0 auth emails. Centred
  Fibre logo at the top, white canvas (no bordered card), Help /
  About / Legal footer, whitelist-our-address hint, legal address
  line. Booking + cancellation emails now read as one family with
  sign-in / magic-link / etc.
- **Google Calendar event creation** now passes `sendUpdates: 'none'`
  so Google no longer emails the invitee a separate calendar invite.
  Fibre Meet's branded confirmation email is the sole notification.
  Same change applied to event deletion (cancel path) so Google
  doesn't double up on cancellation either.
- The invitee is still listed as an attendee on the host's Google
  Calendar event, so the host's calendar shows who's coming. Just no
  Google-sent email.

### Honest gap
- The Fibre confirmation email doesn't yet include an `.ics`
  attachment. Invitees who relied on Google's invite to auto-populate
  their calendar will need to add the meeting manually. Adding an
  attached `.ics` is a clean follow-up — small.

## [0.13.3] — 2026-05-17

### Meet's display version decoupled — sidebar now shows v2.0.0

Meet is the rebuild of Suite v1, so calling it `0.13.x` in the
sidebar didn't reflect its lineage. Meet now has its own
user-facing version, starting at **v2.0.0**, independent of the
monorepo release cadence in `package.json` (which keeps tracking
cross-package work).

### Changed
- `apps/meet/app/(app)/layout.tsx` `VERSION` constant → `'2.0.0'`.
- `CLAUDE.md` "Version bumps" section updated: from now on, bump
  Meet's VERSION independently when Meet-specific surfaces ship;
  don't mass-bump in lockstep with platform-wide releases.

## [0.13.2] — 2026-05-17

### Booking approval — host default + per-MT override

A meeting type can now require host approval before a booking
auto-confirms. Default is set on the host profile and individual
MTs can override it.

### Added
- Migration `20260517240000_meet_booking_approval.sql`:
  `meet_host.requires_approval` (bool default false) and
  `meet_meeting_type.requires_approval` (nullable bool — null = inherit).
  Booking status enum gains `pending_approval`.
- **Booking POST** computes effective approval (MT-level wins; null
  falls back to host default). When true:
  - Booking inserted with `status='pending_approval'`
  - Google Calendar event + confirmation emails are skipped
  - Invitee gets "request received"; host gets "approval needed"
  - Activity event is `meeting_requested` instead of `meeting_booked`
- **`POST /api/v1/meet/bookings/:id/approve`** — host-only; creates the
  Google Calendar event + sends the normal confirmation email + flips
  status to `confirmed`. Mirrors the auto-confirm path exactly.
- **`POST /api/v1/meet/bookings/:id/reject`** — host-only; flips to
  `cancelled`, sends a "declined" email (optional reason).
- **Settings → Profile** gains "Require my approval before a booking
  is confirmed" checkbox (host-level default). Presence sentinel
  hidden input so unchecking actually persists.
- **MT editor → Availability tab** gains "Approval" section with
  three radios: Use my default / Always require / Never require.
- **Booking dialog** shows amber "Pending" status; when pending,
  Approve and Reject buttons appear in the footer.
- **Bookings list rows** show amber "Pending" pill alongside the
  existing Confirmed/Cancelled.
- **Public confirmation page** branches copy when status is
  `pending_approval` — "Your request is in" instead of "You're booked",
  with a line explaining the host will review.
- **Bookings list query** keeps `pending_approval` rows visible even
  when "Include cancelled" is off — hosts shouldn't have to opt in to
  see bookings they need to act on.

### Honest gap
- Reject email is plain text; no "request a different time" loop yet.
- No reminder if a pending request sits >24h. Easy follow-up.
- Approval state is per-host (the MT owner), not per-team-lead — if
  the MT is a team type, the owner-host's policy still governs.

## [0.13.1] — 2026-05-17

### Phase 2: Stripe Connect (paste flow) + price on MT

Hosts can now connect Stripe and assign a price to a meeting type.
The actual Stripe Checkout redirect on booking is Phase 3 — saving a
price today reserves the field but doesn't yet trigger payment.

### Added
- **Settings → Payments page** (`/settings/payments`) — paste-style
  Stripe Connect onboarding mirroring Suite. Pastes `acct_…`,
  validates format, shows Connected/Not connected pill.
- **MT editor → Pricing tab** is no longer the stub. Paid radio is
  live; price input (decimal) + currency dropdown (EUR/USD/GBP)
  appear when Paid is selected.
- **API: `HostUpdate` zod** accepts `stripe_account_id` with regex
  guard (`^acct_…`).
- **API: `MeetingTypeUpsert` zod** accepts `price_cents`
  (int 0–10,000,00) + `price_currency` (3-letter ISO).
- **API: POST/PATCH `/meeting-types` guard** — if `price_cents > 0`
  and the host has no `stripe_account_id`, returns a 400 with
  "connect Stripe in Settings → Payments before setting a price"
  (visible inline in the form thanks to v0.12.3's error pipeline).
- **Action: `bodyFromForm`** converts `price_major` (decimal string
  like "49.00") to cents, nulls out price columns on paid→free flip
  so stale prices don't linger.

### Honest gap
This commit ships the *plumbing* for paid MTs — connection +
price storage + guard. Phase 3 (Stripe Checkout redirect, webhook,
payment_status updates) is next. A paid MT today still completes
booking as if free; that changes in Phase 3.

## [0.13.0] — 2026-05-17

### Intake forms ship; pricing/payments roadmap published

Sjoerd asked for the full Suite-equivalent Pricing + Payments surface
(intake, price, Stripe + PayPal + Invoice, refunds, invoice emails,
tax). That's ~5-6 days of focused work — see
[`docs/meet-pricing-roadmap.md`](docs/meet-pricing-roadmap.md) for the
phased plan. This release ships Phase 1 only.

### Added (Phase 1 — Intake forms, end-to-end)
- **API: `PUT /api/v1/meet/meeting-types/:id/intake`** — upserts
  the `meet_intake_form` row and links it via `intake_form_id`.
  Empty fields detaches and cleans up. Zod-validated.
- **API: MT list endpoint** now also pulls
  `intake_form:intake_form_id (id, name, fields)` so the editor can
  preload.
- **Editor: Intake tab** is wired up. The pre-existing
  `IntakeFieldsEditor` component (5 field types, drag-reorder,
  cascade-delete, conditional logic) is now mounted. Saves
  out-of-band from the main MT PATCH via the new `saveIntakeFields`
  server action.
- **Public booking page** already rendered intake answers and
  stored them on `meet_booking.invitee_answers` — confirmed working
  end-to-end now that the editor exists.

### Roadmap published
- [`docs/meet-pricing-roadmap.md`](docs/meet-pricing-roadmap.md)
  documents how Suite implements each piece (read fresh today), what
  our schema already supports (it's already there from v0.10.x), and
  the 8-phase implementation order. Two decision points flagged for
  Sjoerd: Stripe Connect onboarding style (paste vs OAuth) and
  whether PayPal ships at all (recommend skip).

### Honest scope
This commit ships Phase 1 only (intake). Phases 2-6 (Stripe Connect,
Checkout, invoice mode, refunds, invoice numbering+email) are queued
in priority order. PayPal (Phase 7) and Tax (Phase 8) are recommended
as defer-unless-asked.

## [0.12.8] — 2026-05-17

### Click-to-open booking popup everywhere; Month calendar grid; per-contact appointment list

### Added
- **Shared `BookingDetailsDialog`** (`components/booking-details-dialog.tsx`)
  — one modal renders booking info from any surface. Used by Dashboard
  "Next up", Bookings list, and the Contact popup. Has Join, Cancel,
  and Close buttons.
- **`ClickableBookingRow`** wrapper — turns any server-rendered row
  into a click target that opens the dialog. Reused across surfaces.
- **Bookings → Month view** is now a real 6×7 calendar grid (Mon-first
  weeks, days outside the month dimmed, today's number in a filled
  pill). Each day cell shows up to 3 booking chips ("HH:MM Name")
  plus "+N more" overflow. Chips click straight to the dialog.
- **Contact popup → Appointments list.** Lazy-loaded via a new server
  action `listContactBookings(email)` calling
  `GET /api/v1/meet/bookings?invitee_email=…`. Each row clicks to
  the same `BookingDetailsDialog`.
- **API**: `GET /api/v1/meet/bookings` accepts `?invitee_email=` to
  scope a result list to a single person.

### Changed
- **Bookings view toggle** (`List / Week / Month`) is now icon-only —
  the labels are in `title` + `aria-label` for screen readers.
- **Bookings list rows** lost the inline "Join" link (it's in the
  popup now) and gained a `cursor-pointer` row hover.

### Honest gap
- **Week view** is still the previous day-grouped list, not a
  Google-Calendar-style 7-column hour grid. The Month grid lands
  first because it's the higher-leverage view; Week-as-hour-grid is
  queued as a separate change (~half-day's work).
- **Reschedule** still doesn't atomically cancel+rebook — same v0.12.7
  caveat applies; the popup's cancel link routes to the existing
  cancel page.

## [0.12.7] — 2026-05-17

### Booking confirmation gets a card + real buttons; per-MT "show on overview" toggle

### Added
- **`is_public_listed` on `meet_meeting_type`** (migration
  `20260517230000_meet_mt_public_listed.sql`). Default `true`.
  When `false`, the MT is bookable via its direct link but omitted
  from `/api/v1/meet/public/host/:slug` and `/api/v1/meet/public/team/:slug`.
- **Visibility section on the Availability tab** with a checkbox:
  "Available on personal overview page". Wires to the new column.
- **`MeetingTypeUpsert` zod schema** accepts `is_public_listed`.

### Changed
- **Booking confirmation page** (`/[hostSlug]/[mtSlug]/confirmed/[bookingId]`)
  redesigned as a floating card on `bg-neutral-50` to match the
  booking-page card style. Two real buttons replace the plain link:
  **Reschedule** (goes to the booking page so the invitee can pick a
  new time — the old booking persists, cancel separately) and
  **Cancel** (goes to the existing cancel flow). "← Back to host" lives
  in a subtle footer band.

### Honest gap
"Reschedule" currently just re-opens the booking flow; the old slot is
not auto-cancelled. A proper reschedule (atomic cancel+rebook with a
single email) is a follow-up.

## [0.12.6] — 2026-05-17

### Fix: saving from any non-Basics tab returned 400 (slug/name missing)

Each tab in the meeting-type editor was conditionally mounted, so
switching to Conferencing/Availability/Pricing/Intake unmounted the
Basics tab and dropped `name` + `slug` from FormData on submit. The
API rejected with 400 (slug too short, name required) — exactly what
the user saw clicking Save from the Conferencing or Availability
tab.

### Changed
- **`apps/meet/app/(app)/meeting-types/form.tsx`** — every tab is now
  rendered in the DOM at all times and just hidden via the `hidden`
  Tailwind class when inactive. All form inputs are present in
  FormData regardless of which tab the user is on.
- **Zoom + Microsoft Teams** in the Conferencing provider dropdown
  now show "— coming soon" and are unselectable (`<option disabled>`).
  They had been pickable but generated no meeting URL on booking.
- **`apps/meet/components/ui/field.tsx` `SelectField`** option shape
  gains `disabled?: boolean` (and appends "— coming soon" automatically).
  General-purpose so other forms can mark not-yet-built options too.

## [0.12.5] — 2026-05-17

### Editor Event-type dropdown now mirrors the "+ New" menu

The in-editor Event-type select used to be a plain native dropdown
showing only the label. Now it's a rich popover with the same icon,
"1 host → N invitees" sub-line, and one-line description the user
saw when creating the MT — so they can always tell what the meeting
type actually does.

### Changed
- **New shared component** `apps/meet/components/event-type-picker.tsx`
  — single source of truth for `EVENT_TYPES` metadata, the menu-row
  presentation (`EventTypeMenuList`), and a controlled
  `EventTypePicker` for the editor.
- **`apps/meet/app/(app)/meeting-types/new-menu.tsx`** now imports
  `EventTypeMenuList` instead of duplicating the rows. The "+ New"
  menu UX is byte-identical; just deduplicated.
- **`apps/meet/app/(app)/meeting-types/form.tsx`** — Event-type
  `SelectField` replaced with `<EventTypePicker>`. The trigger button
  shows the current event type's icon, label, and "1 host → 1 invitee"
  sub; clicking opens the same six-row popover the New menu uses,
  with team-only types disabled and labelled "Switch to Team scope to
  use this." Hint text under the picker is the option's description
  (e.g. "Coffee chats, intro calls, 1:1 reviews.").
- Local duplicate `EVENT_TYPES` array in form.tsx deleted.

## [0.12.4] — 2026-05-17

### Fix: MT save 500 — `conflict_calendar_ids` NOT NULL violation

Save failed on team-flip with "null value in column
conflict_calendar_ids violates not-null constraint". The column is
`uuid[] not null default '{}'` but the UI sends `null` to mean "use
host default."

### Changed
- **API: POST and PATCH `/meeting-types`** coerce
  `conflict_calendar_ids: null` → `[]` server-side so third-party
  callers don't have to know which columns are nullable. v0.12.3's
  improved error surfacing made this diagnosable in one save attempt.
- **Meet's sidebar VERSION constant** had been stuck at `0.9.0` while
  package.json marched up. Both web and meet now bump in lockstep
  (apps/meet/app/(app)/layout.tsx).

## [0.12.3] — 2026-05-17

### Surface API error detail on MT save instead of bare "API 500"

Sjoerd reported a 500 on flipping a personal one_on_one MT to team
collective. The form just said "API 500" — no actionable detail.

### Changed
- `apps/meet/app/(app)/meeting-types/actions.ts` — both
  `createMeetingType` and `updateMeetingType` now pull
  `error`/`details`/`code` out of the response body via a shared
  `formatApiError()` and render that string in the form's red banner.
- Paired with the structured stderr logging from v0.12.2, the next
  500 is fully diagnosable: the Postgres message (e.g. unique
  index name, RLS hint, CHECK constraint name) shows up inline in
  the UI **and** in `fly logs -a thefibre-api`.

## [0.12.2] — 2026-05-17

### Harden PATCH /meeting-types/:id; trace what gets persisted

User reports team scope flips back to personal after save+reload on
prod. Couldn't reproduce from a code read — every path traces to "this
should work." Two changes ship together:

### Changed
- **Mirror the POST guard on PATCH.** Previously only the create path
  verified the caller is a lead of the destination team; the update
  path accepted any team_id. Now PATCH 403s if the caller isn't a
  lead. Defence-in-depth and removes one class of "silent succeed,
  row not visible" scenarios.
- **Structured logging on every PATCH outcome.** Logs the requested
  team_id/event_type vs what came back from the DB. RLS failures get
  full code/details/hint logged. Next time someone reports this, the
  Fly log (`fly logs -a thefibre-api`) tells us in one line whether
  the API even got the team_id, whether the DB accepted it, and what
  came back.

### Why this matters
Brief reviewer note (v0.3 retro): "open the API log first, hypothesise
second." This commit makes that possible for the MT save path.

## [0.12.1] — 2026-05-17

### Fix: `/settings/availability` crashed in prod

`WorkingHoursEditor` reads `value[day].length` for each of the seven
days, but the three callers passed `working_hours` straight from the
API with a `as Schedule` cast. Any saved row missing a day key
(common — Saturday/Sunday often absent) crashed React on mount with
"client-side exception."

### Changed
- All three callers (settings page, settings/availability, meeting-type
  editor) now use the existing `coerceSchedule()` helper from
  `components/working-hours-editor.tsx`, which guarantees all 7 day
  keys are present (empty array per missing day) before the editor
  ever reads them.

## [0.12.0] — 2026-05-17

### Added: One-off and Meeting-poll event types

The last two stubs in the New-Meeting-Type chooser ship for real. Fibre Meet
now supports every event type drawn on the original wall: One-on-one, Group,
Round-robin, Collective, **One-off**, and **Meeting poll**.

### Changed
- **New migration `supabase/migrations/20260517210000_meet_one_off_and_poll.sql`**
  adds `fixed_starts_at`/`fixed_ends_at` (nullable timestamptz with paired
  CHECK + window CHECK) to `meet_meeting_type`, and creates two tables for
  polls: `meet_poll_slot` (composite PK `(meeting_type_id, starts_at)`) and
  `meet_poll_vote` (one row per `(voter, slot)`, deduped via UNIQUE). RLS on
  both poll tables defers to the parent meeting type — if you can see the
  MT, you can see its slots and votes.

- **API: `MeetingTypeUpsert` zod schema** accepts `one_off` and `poll` as
  `event_type` values, plus optional `fixed_starts_at` / `fixed_ends_at`
  datetimes.

- **API: `POST /api/v1/meet/public/bookings`** validates `starts_at` against
  the MT's `fixed_starts_at` for one-off bookings, rejects with
  `409 wrong_fixed_time` on mismatch. Capacity from v0.11.1 is reused —
  default 1 (single-attendee interview), but the editor offers the same
  CAPACITY_OPTIONS dropdown so a one-off can also be a small group event.
  Poll MTs are not bookable directly (`400 poll_not_bookable`).

- **API: slots endpoints** (`/public/host/.../slots` and team variant)
  short-circuit for `one_off` (return just the fixed slot with `slots_meta`)
  and `poll` (return `{ slots: [] }`). Public MT GET endpoints attach
  `poll_slots: [{starts_at, ends_at}]` when the MT is a poll.

- **New auth'd endpoints** on `apps/api/src/routes/meet.ts`:
  `GET /meeting-types/:id/poll` (slots + votes for the host),
  `PUT /meeting-types/:id/poll-slots` (replace candidate slots, 2–5),
  `POST /meeting-types/:id/confirm-poll-slot` (flip a poll into a one-off
  with `fixed_starts_at` = winning slot — see "trimmed scope" below).

- **New public endpoint** `POST /api/v1/meet/public/poll-votes` lets an
  invitee submit `{ meeting_type_id, voter_email, voter_name,
  slot_starts_ats[] }`. Re-submission from the same email replaces that
  voter's existing rows (so changing your mind just works). Bypasses RLS
  via `adminClient` like the rest of `/meet/public/*`.

- **UI: Meeting-type editor** (`apps/meet/app/(app)/meeting-types/form.tsx`):
  the event-type dropdown adds One-off and Meeting poll for personal scope
  too. When One-off is selected, the Availability tab disappears and a
  "Date & time" `<input type="datetime-local">` + Capacity dropdown appear
  on Basics. When Meeting poll is selected, the Availability tab is
  relabelled **Candidate slots** and renders a dedicated editor with 2–5
  datetime rows + Add/Remove buttons. Slots save out-of-band via the new
  `savePollSlots` server action.

- **UI: MT detail page** (`apps/meet/app/(app)/meeting-types/[id]/page.tsx`)
  loads `/meeting-types/:id/poll` for poll MTs and renders a new
  **`PollVotesMatrix`** (`votes.tsx`) — voters down rows, candidate slots
  across columns, ✓ in each cell where the voter ticked. Each column header
  shows vote count + a "Confirm" button that calls the confirm-poll-slot
  endpoint.

- **UI: New-MT chooser** (`new-menu.tsx`): both `disabled: true` flags
  removed; One-off + Meeting poll are now bookable from the menu.

- **UI: Public booking page** (`apps/meet/app/[hostSlug]/[mtSlug]/`):
  `BookingFlow` branches on `event_type`. One-off renders a single
  "Scheduled for {datetime}" block + name/email + "Confirm attendance".
  Poll renders a checkbox list of the candidate slots + name/email +
  "Submit votes", with a thank-you state on success.

### Trimmed scope (documented gap)
"Confirm this slot" on a poll currently just flips the MT into `one_off`
with the winning slot set as `fixed_starts_at`. **It does not auto-create
bookings for every voter who ticked that slot, and it does not email the
losing voters that the poll closed.** The host gets a stable one-off MT
URL they can share again to collect attendance confirmations. Auto-booking
+ poll-close email notifications are the obvious next pass; they were
trimmed because they triple the surface area (template wiring + Resend
batch send + idempotency) without adding much for v1 use.

### Gotchas
- `<input type="datetime-local">` reads as local time. The form converts
  to UTC ISO before sending so the API stores in UTC. Read-back goes
  through `toLocalDatetimeInput()` which formats in the host's local tz.
- Poll slot rows persist after a poll is "confirmed". They aren't read
  by any active code path but show up in an erasure export — that's
  fine and arguably useful (audit trail of which slots existed).
- `meet_poll_vote.UNIQUE(meeting_type_id, voter_email, slot_starts_at)`
  + the "delete-then-insert" replace pattern means a fast double-submit
  could in theory cause a unique-violation on a race. The delete-then-
  insert isn't wrapped in a transaction; if it surfaces we'll wrap in
  one. Not a v1 blocker.

## [0.11.1] — 2026-05-17

### Added: Fibre Meet Group event type

Fibre Meet's "Group" event type is no longer a stub. A single host can now
offer slots that multiple invitees share until a per-MT capacity is reached.

### Changed
- **New column `meet_meeting_type.capacity`** (nullable integer, CHECK > 0)
  in `supabase/migrations/20260517200000_meet_group_capacity.sql`. Only
  meaningful when `event_type='group'`. Bookings are grouped by the
  existing `(meeting_type_id, starts_at)` tuple — no extra `slot_key`
  column needed.
- **API: `POST /api/v1/meet/public/bookings`** now performs a capacity
  check before insert when the MT is `event_type='group'`. If the
  confirmed-booking count for `(meeting_type_id, starts_at)` already
  meets capacity, the request is rejected with `409 { error: 'fully
  booked', code: 'slot_full' }`. No waitlist yet — that's a follow-up
  behind a per-MT toggle.
- **API: slots endpoints** (`/public/host/.../slots` and
  `/public/team/.../slots`) skip the MT's own bookings from the host's
  busy intervals when `event_type='group'` (so the slot stays bookable
  until full), and return a parallel `slots_meta` array with
  `{ starts_at, capacity, booked, remaining }` per slot. Fully booked
  slots are removed from `slots` entirely.
- **API: `MeetingTypeUpsert` zod schema** accepts `capacity` (int 1–1000,
  nullable). Server stores it on create + update.
- **UI: Meeting-type editor** (`apps/meet/app/(app)/meeting-types/form.tsx`):
  the event-type chooser now also shows up in Personal scope (since Group
  is single-host). Personal scope offers One-on-one and Group; Team scope
  adds Round-robin and Collective. When Group is selected, a curated
  "Capacity" dropdown appears in Details (2/4/6/8/10/12/15/20/30/50,
  default 12).
- **UI: New-MT chooser** (`apps/meet/app/(app)/meeting-types/new-menu.tsx`):
  the Group option is no longer `disabled: true`.
- **UI: Public booking page** (`apps/meet/app/[hostSlug]/[mtSlug]/`):
  Group MTs show a `Users` icon row in the sidebar ("Up to N invitees
  per slot"), and each time-slot button shows "X of Y left" pulled
  from `slots_meta`. If a slot happens to fill while the user is on
  the page, the 409 surfaces as "This slot just filled up. Please
  pick a different time."

## [0.11.0] — 2026-05-17

### Added: GDPR Article 15 self-service data export

The Privacy page's "Export my data" card is no longer a "Coming soon"
stub. One click downloads a single JSON file containing every piece of
personal data The Fibre stores about the caller, across every app.

### Changed
- **New endpoint `GET /api/v1/privacy/export`** in `apps/api/src/routes/privacy.ts`.
  Pulls in parallel from `user`, `person`, `user_identity_provider`,
  `app_membership`, `workspace_member`, `org_membership`, `activity`,
  `meet_booking`, `person_professional`, `person_change_context`,
  `person_relationship_context`, `person_learning`, `person_billing`,
  `person_tag`, `consent_record`, `data_subject_request`,
  `app_record_link`, `relationship` (outgoing + incoming) and the
  caller's `workspace`. Top-level `_meta.included_categories` lists
  every category considered, so a receiver can verify completeness.
- Uses `adminClient` (RLS bypass) with an explicit
  `user_id`/`person_id`/`workspace_id` filter on every query. Article
  15 supersedes UI-level app-membership scoping: a user is entitled
  to their `person_billing` row even if they don't currently hold the
  Sales app membership.
- Side-effect: each successful export writes a `data_subject_request`
  row of type `access`, status `completed`, for the audit trail.
- Response sets `Content-Disposition: attachment;
  filename="fibre-data-export-{email-slug}-{YYYY-MM-DD}.json"` so
  browsers save the file with a meaningful name.

- **New Next.js route handler** at `apps/web/app/(app)/privacy/export/route.ts`.
  Vercel-side proxy that forwards the user's Supabase access token to
  the API and streams the JSON response back. Hard rule §13 still
  holds — Vercel forwards bytes, never reads the payload.

- **`ExportButton` on the Privacy page.** Client component that
  fetches `/privacy/export`, materialises the response into a Blob,
  reads `Content-Disposition` for the filename and triggers a download
  via a synthetic `<a download>`. Shows "Preparing…" while in flight
  and an inline error if the export fails.

### Why this matters
Article 15 is the right of access. Until v0.10.4 we had the right of
erasure (Article 17) wired up but no way for a user to *see* what we
held about them — only what the UI surfaced. v0.11.0 closes that gap.
"The app justifies the field" (brief §5) means every field has a
reason to exist; Article 15 means every field also has to be
disclosable on demand. The export covers both first-party apps
(Platform, Meet) and any third-party app that has registered itself
in `app` and written into `app_record_link`.

### Gotchas / follow-ups
- The export currently runs synchronously in a single request. Fine
  for the current shape of data (one user, a few hundred rows at
  most). If a workspace ever sees an activity log in the thousands
  per person, move to a background job + presigned download URL.
- `relationships` is split into `outgoing` / `incoming` to keep
  semantics clear (some types like `introduced_by` are directional).
- `_meta.subject` is the canonical identity bundle for the export —
  if a receiver (e.g. a different controller) needs to know "who is
  this file about", that's the block to read.

## [0.10.4] — 2026-05-17

### Fix: Meet was showing the full workspace contact graph

Brief §5 ("the app justifies the field") and §13 (data wall) say each
app sees what it has a reason to see. The Meet Contacts page was
returning every `person` in the workspace — a quiet leak across the
app boundary.

### Changed
- **`GET /api/v1/meet/contacts`** now scopes to persons Meet justifies
  knowing about: invitees on any `meet_booking`, plus members of any
  `meet_team` in the workspace. Two-source UNION, computed in the
  route. Everyone else is no longer returned.
- Each row carries a `source: ('booking' | 'team')[]` field plus
  `is_team_member`, so the UI can explain *why* a person is surfaced
  (and so future audits can replay the justification).
- Meet Contacts page description updated to match. Two new chips on
  each row: `Team` and `Booked`. Empty state now reads "No-one has
  booked yet, and your teams have no members."

### Why this matters
This was the exact pattern the data wall is designed to prevent: an
app sees data it didn't earn. The Fibre platform is the source of
truth for identity; Meet only surfaces the slice tied to its own
records. Sales, Learn, Thread will follow the same shape when they
ship contact views.

## [0.10.3] — 2026-05-17

### Third-party apps can now identify themselves end-to-end

The two blockers a real third-party connector hits on day one are
fixed. An external app registered in `public.app` can call the API as
itself and push activities using its own type names.

### Changed
- **`X-App-ID` accepts any registered app slug.** The middleware's
  hardcoded enum (`fibre-platform`, `fibre-meet`, etc.) is replaced
  with a cached lookup against `public.app` (5-min TTL, refresh on
  miss). Once `mailchimp` is in the table, `X-App-ID: mailchimp` works
  on the second request at the latest. Unknown slugs now return a
  clearer `unknown-app-id` problem instead of the generic
  `missing-app-id`.
- **`activity.type` is no longer enum-locked.** Replaced the
  `z.enum(ACTIVITY_TYPES)` validator with a snake_case regex
  (`^[a-z][a-z0-9_]{1,63}$`). Manifest-declared types like
  `newsletter_opened` are accepted directly. `subject` is still
  length-limited per brief §6 — type is just a machine label, content
  belongs in subject.
- **Demo script** now calls in as `mailchimp` with type
  `newsletter_opened` — no more workaround comments.
- **Third-party guide** trimmed: those two gaps moved from "Open gaps"
  to "Done".

## [0.10.2] — 2026-05-16

### Cross-app entity mapping — docs + runnable third-party demo

The schema (`app_entity_mapping` + `app_record_link`) and the four
`/api/v1/apps/...` routes have been live since v0.10.x but only Meet
used them internally. This release closes the documentation gap so an
external integrator can pick up the surface end-to-end, plus a worked
example script.

### Added
- **`docs/third-party-app-guide.md`** — step-by-step walkthrough:
  manifest format → register the app + mappings → link records → push
  activities → reverse lookup. Honest about every gap a third party
  hits today (no external `X-App-ID`, no API keys, no self-register
  endpoint, no bulk linking, no curator-data write API, scopes
  unenforced, custom activity types unmerged).
- **`apps/api/scripts/demo-third-party-app.mjs`** — ~180-line idempotent
  Node script that simulates a "Mailchimp" connector: registers the
  app, declares an entity mapping, links three subscribers (two
  existing EBBF persons + one created via `create_if_missing`), pushes
  activities, and reverse-looks-up the link + full person row. Run
  with `FIBRE_JWT=… node scripts/demo-third-party-app.mjs`.

### Changed
- **`docs/cross-app-entity-mapping.md`** — removed the "draft, before
  any code" framing now that everything in §"The model" has shipped.
  Added a "What actually shipped" section that maps each piece of the
  proposal to a file (migration / route / manifest) and lists the seven
  still-open gaps.

## [0.10.1] — 2026-05-16

### Per-app curator-data labelling reaches the org side

The pattern shipped for contact profiles (chip on each curator-data
section + app suffix on every "Edit X" dialog title) now lands on
organisation profiles too — so a viewer always knows which app justifies
a given field.

### Changed
- `organisations/[id]/app/[appSlug]` — "System context" gets a
  `Fibre Meet` chip; "Commercial relationship" and "Invoicing" get a
  `Fibre Sales` chip. Uses the same `AppChip` component as the contact
  side.
- Edit dialog titles: "Edit system context — Fibre Meet", "Edit
  commercial relationship — Fibre Sales", "Edit invoicing details —
  Fibre Sales".

## [0.10.0] — 2026-05-16

### Auth emails now route through our API — branded, with SPoT

Supabase's "Send Email" hook is configured to call our API for every
auth email (signup, sign-in, magic link, invite, password reset, email
change, reauthentication). The API renders the email from
`packages/shared/src/branding.ts`, so a rename or white-label is one
file change. End-to-end verified: logo, headline, 8-digit code box,
CTA, and footer all arrive correctly.

### Added
- **`POST /api/v1/auth-hook/email`** — handles the Supabase Send Email
  Hook. HMAC-SHA256 verification per the standardwebhooks spec; renders
  via `auth-templates.ts`; sends via Resend.
- **Eight auth email types** rendered in Thread-style identity: centred
  Fibre wordmark, "Almost there" headline, big code box, optional CTA,
  reassurance paragraph, divider, Help/About/Legal footer + whitelist
  hint + legal address line.
- **`BRAND_ASSETS`** on `packages/shared` — logo URL, native dimensions,
  alt text. Single source of truth for the wordmark across web + emails.
- **The Fibre wordmark** hosted at `https://thefibre.app/brand/the-fibre.png`
  (1404×704 PNG, served from `apps/web/public/brand/`).
- **`/sign-in` page** on `thefibre.app` exposing the same Google +
  8-digit email-code flow Meet has on its landing.

### Changed
- Sign-in input accepts **8 digits** (matches Supabase OTP length).
- `legalFooterLine()` no longer includes the legal entity name on public
  surfaces. `ENTITY.name` (Solidarity Lab B.V.) remains in `branding.ts`
  for internal billing / invoicing.
- Fly machine pinned to `min_machines_running = 1`, `auto_stop_machines = off`
  — Supabase auth hooks have a 5s ceiling, cold starts blow it.
- HMAC secret parser accepts `v1,whsec_xxx`, `whsec_xxx`, or bare base64
  so dashboard copy-paste just works.

### Sjoerd action
- Rotate the Resend API key still pending from v0.8.0.

## [0.9.0] — 2026-05-17

### Permission tiers — within-workspace visibility lands

The platform's access model grows a second axis. Workspaces no longer treat
every member as "sees everything"; visibility is per-resource (each Meet team,
program, etc. carries `members_only | org_wide`) and users carry a
`relationship_type` (`internal | external`) that decides whether they get the
org-wide widening. See `docs/permission-tiers-proposal.md` for the resolved
model and `docs/fibre-vs-app-data.md` for how this slots into the brief.

### Added
- **`public.workspace_member`** pivot table (`user_id`, `workspace_id`,
  `workspace_role` = admin|member, `relationship_type` = internal|external,
  `member_status`). Multi-org ready from day one — a person can be a user in
  multiple organisations cleanly when we need it.
- **`visibility` column** on `meet_team` and `program`, default `members_only`,
  opt-in `org_wide`. Editable by leads / org admins via the team detail page.
- **`can_see_person()`, `can_see_organisation()`, `can_see_activity()`,
  `is_workspace_admin()`** — all `SECURITY DEFINER` SQL helpers, granted only
  to `authenticated`. `can_see_person` covers six clauses (admin / self /
  shared Meet team / shared program enrolment / org_wide widening for
  internals / hosted-a-booking with them).
- **RLS rewritten** on `public.person`, `public.organisation`, `public.activity`
  (SELECT), and `public.meet_booking`. Workspace check stays as the cheap
  pre-filter; the helper provides the per-row gate.
- **API endpoints**:
  - `POST /teams/:id/members` + `POST /internal-team` accept
    `relationship_type` for new users.
  - `PATCH /teams/:id` accepts `visibility`.
  - `PATCH /internal-team/:userId` (admin-only) flips `workspace_role`,
    `relationship_type`, `member_status`.
  - `GET /internal-team` returns the per-row workspace_role +
    relationship_type + member_status.
- **UI**:
  - Team invite form + Internal-team invite gain a Relationship select.
  - Team detail page gains a Visibility card (radio: members_only / org_wide).
  - Internal-team page renders role + relationship chips; admins see editable
    selects.

### Backfill
- Every existing `user` row gets a `workspace_member` row.
  `workspace_role='admin'` iff they hold a `fibre-platform` `app_membership`
  with role `admin`; otherwise `member`. `relationship_type='internal'` for
  all. All existing teams + programs start `members_only`.

### Migration
- `20260517000000_permission_tiers.sql` — schema + helpers + RLS + backfill.

### Behavioural change to watch
Workspaces that previously had everyone-sees-everything now scope per
resource. The seeded `sjoerd@soul.com` workspace is unaffected (single admin
sees everything via the admin shortcut). When you invite future members,
choose Internal or External; Internal users see org-wide things, External
only see resources they're explicitly added to.

## [0.8.0] — 2026-05-16

### Suite v2 — Fibre Meet matures into a real scheduler

This release lands the rest of the Suite UI port and the structural primitives
underneath it. Most of the changes are visible in commits 92ea693 …
through d74dae9 over the day. See `docs/meet-architecture.md` for the running
reference and `docs/meet-api.md` / `docs/meet-data-model.md` for endpoint + schema docs.

### Added — invite-by-email + two-step accept (team invites)
- Inviting an email that doesn't yet have a workspace user pre-creates a `user` + paired `person`, grants `fibre-meet` membership, and writes a `meet_team_member` row with `status='invited'` plus a unique `invite_token`. The invitee gets an email pointing at `meet.thefibre.app/invite/<token>`.
- New public `/invite/[token]` accept page peeks at the invite (no auth), prompts sign-in if needed, and on Accept flips status to `active`, clears the token, and seats the user in the right workspace.
- Pending invites are excluded from round-robin / collective rosters and from the user's own `/teams` list — they only count once accepted.
- Lead-only actions on the team detail page: **Copy link** (so the lead can DM the URL when email is unreliable), **Resend** (rotates the token + re-emails), **Revoke**.
- API: `POST /teams/accept-invite/:token`, `GET /public/invite/:token`, `POST /teams/:id/members/:userId/resend-invite`.

### Added — identity invariant: every workspace user has a paired `public.person`
- Both invite paths (team-member + internal-team) now create a `person` and link `user.person_id` both ways.
- New SECURITY DEFINER helper `public.ensure_user_person(user_id)` called from `resolve_sso_identity()` on every match path so the invite-then-signin flow completes the link.
- Startup heal block in the migration cleans up legacy rows (`person_id IS NULL`).
- Meet's `/contacts` page rewritten to read from `public.person` (workspace-scoped) instead of aggregating from `meet_booking`. Meet decorates each person with its booking summary — that's the curator data it justifies.

### Added — meeting-type editor as tabs + per-MT overrides
- Tabbed editor in the Suite layout: **Basics / Availability / Conferencing / Pricing / Intake**, with a sticky save bar at the top and white cards on a light grey background.
- Personal vs Team is a 2-card chooser (clicking Team reveals a Team dropdown below — no select-in-a-select, no sub-picker in the New menu).
- Duration / buffer / notice / advance are curated dropdowns (`None / 15 min / 30 min / …` / `1 day / 7 days / …`) instead of free-form number inputs.
- New columns: `meet_meeting_type.working_hours_override jsonb`, `meet_meeting_type.conflict_calendar_ids uuid[]`. NULL falls back to host defaults. The single-host slots endpoint respects both overrides; team route uses `buildPerHostArgs` which picks them up automatically.

### Added — Calendars role management + Re-sync
- `POST /api/v1/meet/calendars/sync` re-pulls the calendar list from Google without re-doing OAuth.
- `minAccessRole: 'reader'` so subscribed / shared calendars surface (previously only owner-tier rows did).
- `meet_calendar.role` now accepts `ignore`; ignored calendars are excluded from freebusy.
- Suite-style Calendars page: card list with a role dropdown per row (Primary / Conflict source / Write target / Ignore) and a Re-sync button.

### Added — Connections (formerly Integrations) consolidates external services
- Personal meeting room URL moved from Profile → Connections (it lives with Zoom/Whereby links, not personal identity).
- Google Calendar connect/disconnect stays here.

### Added — design canon
- Lucide icons across the board (Settings cards, bookings view toggle, new-MT menu, public booking meta). No emoji icons anywhere.
- Unified slug UX in `apps/meet/components/ui/name-slug.tsx`: `[prefix/]  [editable slug]  [Alt]`. Auto-fill from name; Alt regenerates a `<slug>-<rand>` variant. Profile slug field follows the same visual pattern.
- `PageContainer` left-aligned (drops `mx-auto`) — content sits next to the sidebar instead of being centered in the viewport.
- Public-booking page bg neutral-50 with a single white split-card; matches Suite's layout.

### Migrations
- `20260516000000_meet_calendar_ignore_role.sql` — adds 'ignore' to `meet_calendar.role`.
- `20260516010000_sso_link_existing_person.sql` — `ensure_user_person()` helper + updated `resolve_sso_identity()` + startup heal.
- `20260516020000_meet_team_member_pending.sql` — `status` + `invite_token` + `invited_at` + `accepted_at` on `meet_team_member`.
- `20260516030000_meet_meeting_type_overrides.sql` — `working_hours_override jsonb` + `conflict_calendar_ids uuid[]`.

### Fixed
- The earlier "no calendars syncing" — Google Calendar API hadn't been enabled in the Cloud Console project. The error path now logs the underlying message; Sjoerd enabled the API and Re-sync works.
- PKCE `code_verifier` mismatch on second sign-in — documented (stale cookies; use a fresh window).
- Fly machine lease stuck after a half-completed deploy — documented (wait it out).

### Required production secrets (Fly)
Unchanged: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SSO_INTERNAL_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`.

### Operational note
The Resend API key used during this release ended up visible in a development screenshot. **It must be rotated** before the next release: Resend dashboard → API Keys → delete + recreate → `fly secrets set RESEND_API_KEY=…` from repo root.

## [0.7.0] — 2026-05-15

### Added — Fibre Meet step 7 (Round-robin + Collective)
- **Event types on meeting types.** New `event_type` column on `meet_meeting_type` with values `one_on_one` (default), `round_robin`, `collective`, and a reserved `group`. Only team-owned meeting types may use the multi-host modes (enforced by a CHECK constraint).
- **`meet_meeting_type_assignee`** table — eligible team members per MT, with one row marked `is_primary`. Lead-only writes, gated by the existing `meet_is_team_lead()` security-definer helper (no recursion).
- **Multi-host slot composition.** `generateMultiHostSlots(mode, hosts[])` in the availability engine — UNION for round-robin (slot bookable if any host is free), INTERSECTION for collective (every host must be free). Per-host args include each host's own working_hours, busy intervals, and Google freebusy.
- **Team slots endpoint** rewritten to dispatch on `event_type`: loads the assignee roster, builds per-host args (including GCal freebusy in parallel), and returns the right union/intersection. Falls back to single-host mode for `one_on_one`.
- **Team booking POST** now picks the host:
  - `round_robin` — least-loaded eligible host who's free at the chosen slot (rejects with 409 if nobody available).
  - `collective` — primary assignee runs the canonical GCal event; the other assignees are added as event attendees and receive the host-notification email.
- **Google event** supports `extraAttendees` — used to invite the team to a collective booking on one event.
- **Meeting-type editor** learned an "Event type" selector (only shown when team-owned), dynamic hint per option. The detail page renders an **Assignees** section for round-robin / collective MTs with a per-team-member checkbox + primary radio.
- **Assignee CRUD API**: `GET /api/v1/meet/meeting-types/:id/assignees`, `POST` (lead-only; auto-clears prior primary), `DELETE /:userId`.

### Migration
- `20260515030000_fix_team_member_rls_recursion.sql` (shipped between 0.6.0 and 0.7.0) — replaced the self-referencing `meet_team_member` write policy with a `SECURITY DEFINER` `meet_is_team_lead()` helper + split per-verb policies, fixing Postgres `42P17 infinite recursion`.
- `20260515040000_meet_event_types.sql` — adds `event_type` + the `meet_meeting_type_assignee` table with full RLS (read = workspace + fibre-meet; write = team lead via `meet_is_team_lead`). Partial unique index enforces at-most-one-primary-per-MT.

## [0.6.0] — 2026-05-15

### Added — Fibre Meet step 5 (emails + cancel)
- **Booking emails.** Resend-backed transactional emails sent on every booking: a branded confirmation to the invitee (with cancel link) and a notification to the host. Cancellations send to both sides. Plain-text + HTML, formatted in the host's timezone. Templates live in `apps/api/src/lib/email/templates.ts`; transport in `apps/api/src/lib/email/client.ts`. No-ops with a `[email] would send: …` log line when `RESEND_API_KEY` is unset so dev and CI don't need outbound mail.
- **Cancel flow.** New public endpoint `POST /api/v1/meet/public/bookings/:id/cancel` flips the booking to `cancelled`, deletes the linked Google Calendar event (best-effort), and emails both sides. New cancel page at `/[hostSlug]/[mtSlug]/cancel/[bookingId]` with a confirmation step. The confirmation page now surfaces "Need to cancel or reschedule?".

### Added — Fibre Meet step 6 (Teams)
- **Teams.** New `meet_team` + `meet_team_member` tables. A team is a workspace-scoped slugged group with its own member list (roles: `lead` / `member`). Each team gets its own public booking page at `meet.thefibre.app/<team-slug>`. Meeting types can be owned by a team instead of a single host — the meeting-type editor learned a new "Owned by" selector.
- **Shared root namespace.** New `meet_root_slug` table, populated by triggers from `meet_host` and `meet_team`. Single-segment URLs (`/<slug>`) resolve unambiguously to one host or one team per workspace; slug collisions are rejected at create time.
- **Team CRUD + members API.** `GET/POST /api/v1/meet/teams`, `GET/PATCH /:id`, `POST /:id/members` (resolves email → workspace user), `DELETE /:id/members/:userId` (refuses to remove the last lead). Creator becomes lead automatically.
- **Public team booking.** `/api/v1/meet/public/team/:slug`, `/.../mt/:mt_slug`, `/.../mt/:mt_slug/slots`. The Meet front-end dual-resolves any root slug — tries host first, falls back to team — so the same booking flow renders both. The booking flow client accepts an `ownerKind` of `host | team` and picks the matching slots URL.
- **Teams UI.** New /teams list, /teams/new, and /teams/[id] detail with member management. The Meet sidebar gained a Teams nav item.
- **Meeting types page** now groups by Personal + per-team sections, each showing the correct public URL.

### Migration
- `20260515020000_meet_teams.sql` — adds `meet_team`, `meet_team_member`, `meet_root_slug` (with sync triggers), `meet_meeting_type.team_id` column + two partial unique indexes (per-host slug when personal, per-team slug when team-owned), full RLS (workspace + fibre-meet membership; team-member writes gated to leads). Backfills the root-slug table for existing hosts.

### Required env (production)
- `RESEND_API_KEY` and `EMAIL_FROM` on the API host (Fly) for emails to actually send.

## [0.5.1] — 2026-05-14

### Added
- **Per-workspace app activation.** New `workspace_app` table records which apps a workspace has turned on; independent of per-user `app_membership`. New page **Settings → Apps** lists the four installable apps (Fibre Meet, The Thread, Fibre Sales, Fibre Learn) with descriptions and an Activate / Deactivate toggle. Workspace-admin gated (`fibre-platform` role=admin in the current workspace) — non-admins are redirected back to Settings.
- **API endpoints** `GET /api/v1/workspace-apps`, `POST /api/v1/workspace-apps` (activate + auto-grant the activating user a `role='admin'` app_membership), `DELETE /api/v1/workspace-apps/:slug` (soft deactivate — keeps history so old activity rows still resolve their app).
- **Super admin** as a first-class concept. New boolean `is_super_admin` on `public.user`, with SQL helper `public.is_super_admin()`. Sjoerd promoted in the migration. The signup_request admin page and its RLS policies now gate on super-admin (cross-workspace concern). Workspace admins still see their own workspace settings and the Apps page.
- **New workspaces auto-grant** their first user `fibre-platform` role=admin via `resolve_sso_identity()`, so approved applicants land with workspace-admin rights in their own workspace from minute one.

### Changed
- **Dashboard "Your apps"** card now reads from `workspace_app` (what the workspace has installed) intersected with the user's memberships, instead of just the JWT's `app_memberships` claim. Empty state links to /settings/apps.
- **Sidebar "Admin" section** splits cleanly: Apps for workspace admins; Access requests for super admins.

### Migration
- `20260514160000_workspace_apps.sql` — creates `workspace_app` + RLS, adds `is_super_admin` + helper, re-points signup_request policies at `is_super_admin()`, bootstraps the default workspace's currently-seeded app memberships into workspace_app rows, and rewrites `resolve_sso_identity()` to grant new users their workspace-admin membership.

## [0.5.0] — 2026-05-14

### Added
- **Self-serve apply + admin approval.** New public landing page (white, descriptive, request-access CTA) plus a `/request-access` form. Submissions land in a new `signup_request` table. Founding user (sjoerd@soul.com) is bootstrapped to `fibre-platform` role `admin`; admins see an "Access requests" page under a new sidebar Admin section and can approve or deny. Approval auto-provisions a fresh workspace; the applicant lands in it the next time they sign in.
- **`/access-pending` holding page** for users whose sign-in lands without an approved request — three states: pending review, denied, or unknown email (with CTA back to `/request-access`).
- **API endpoints** `POST /api/v1/signup-requests` (public, anon), `GET` and `PATCH /:id` (admin-gated by RLS via new `public.is_platform_admin()` helper), and `POST /api/v1/sso/access-check` (server-to-server, secret-gated) for the auth callback to know whether to let a user through.
- **Auth callback** (`/auth/callback`) now calls `access-check` first, then routes the user to their workspace (existing or just-approved), or to the holding page.

### Changed
- Bumped to **v0.5.0** — first version where Fibre is genuinely multi-tenant. The default seeded workspace remains for the founding user; every new applicant gets their own.
- Landing page reworked from the dark "list of apps" layout to a light, descriptive marketing page that explains what The Fibre is and why before asking the visitor to do anything.

### Migration
- `20260514150000_signup_requests.sql` — creates `signup_request` (with `status` + partial unique index on email), adds the `public.is_platform_admin()` SQL helper, RLS policies, and promotes sjoerd@soul.com to `fibre-platform` admin.

## [0.4.8] — 2026-05-14

### Shipped
- **Live in production.** Web at https://thefibre.app (Vercel, fra1) and API at https://thefibre-api.fly.dev (Fly.io, fra). Sign-in works, contacts/orgs/programmes/activity all flow end-to-end through the real EU API with RLS enforcing workspace + app-membership scoping.

### Fixed
- `@thefibre/shared` now emits a compiled `dist/`. Previously `main` pointed at `src/index.ts`, which worked under tsx (dev) but crashed Node 22 in production with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`. Adds a `build` script, `outDir` + `rootDir` to its tsconfig, and an `exports` map.
- Both apps' build commands now use the pnpm topological filter (`pnpm --filter @thefibre/web... build` / `--filter @thefibre/api... build`). The trailing `...` tells pnpm to include workspace dependencies in topological order, so `@thefibre/shared` gets built before its consumers without hand-chaining. Applied to `vercel.json` (root + apps/web) and the API Dockerfile.
- Contact edit dialog gained the **Preferred language** field. API + DB already accepted it; the form was missing the control so it stayed read-only at "—" on the overview.

### Migration
- `20260514140000_relax_text_arrays_again.sql` — re-applies `drop not null` on text[] columns. The v0.3.9 migration was recorded as applied on remote but the constraints were still tripping `stated_values` etc. Supabase tracks migrations by filename only, so a fresh migration is the right way to re-apply schema changes.

## [0.4.7] — 2026-05-14

### Added
- **Searchable country picker** (`components/ui/country-combobox.tsx`) backed by an ISO-3166 list in `lib/countries.ts`. Type-to-search, arrow-keys + Enter to pick, hidden input submits the ISO 2-letter code. Replaces the free-text 2-letter country field on person and organisation identity edit dialogs. Overview pages now render the full country name instead of the code.
- **Physical address** (`street`, `postal_code`) on platform `person` and `organisation` rows. Surfaced in both the identity edit dialogs and the overview field grids.
- **Invoicing details** as a new fibre-sales curator table — `person_billing` and `org_billing` — with: legal name, tax / VAT ID, billing email, billing address (street / postal code / city / region / country), payment terms (days), currency, PO required, free-form notes. New API endpoints `GET|PATCH /api/v1/persons/:id/billing` and `/organisations/:id/billing`. RLS gates these by `fibre-sales` app-membership — users without sales access never see the section. Section lives on the Fibre Sales tab of each entity alongside Commercial relationship.

### Changed
- `PersonSubResource` and `OrgSubResource` unions in `apps.ts` extended with `'billing'`; the Fibre Sales descriptor lists it alongside `'relationship'` so the apps-discovery query treats it as an emergent tab signal.

### Migration
- `20260514130000_address_and_billing.sql` — additive, idempotent. Adds the address columns, creates the two billing tables with the canonical curator-table RLS policy (`has_app_id` + workspace check).

## [0.4.6] — 2026-05-14

### Changed
- **Renamed Fibre Suite → Fibre Meet** across the entire codebase. Slug `fibre-suite` → `fibre-meet`, subdomain `suite.thefibre.app` → `meet.thefibre.app`, display label `Fibre Suite` → `Fibre Meet`. New migration `20260514120000_rename_fibre_suite_to_meet.sql` updates the `app` row and refreshes the `app.slug` CHECK constraint. All TypeScript type unions (`AppId`, `AppSlug`), the API `VALID_APP_IDS` set, `FORMAT_TO_APP_SLUG`, profile-routing helpers, dashboard `APP_DOMAINS`/`APP_NAMES`, settings, activity, contacts and organisation per-app tabs, redirect shims (`/contacts/[id]/change` and `/organisations/[id]/system-context` now point at `/app/fibre-meet`), the EBBF seed script, and the technical brief have all been updated. Historical migrations and the v0.3 brief are intentionally left as-is.

## [0.4.5] — 2026-05-15

### Added
- **Richer dashboard.** Four stat cards (Contacts / Organisations / Programmes / Activity), recent activity timeline (last 6 events), active programmes list, and the existing your-apps section. Stat values come from parallel best-effort API calls — each fetch is non-fatal so a slow endpoint doesn't break the page. Combined with the seed data, the dashboard now lands on substance instead of an empty welcome.

## [0.4.4] — 2026-05-15

### Added
- **Activity filter by `organisation_id`.** `GET /api/v1/activities` now resolves an org id to the union of its current members' activity (two-step query: resolve members via `org_membership` where `ended_at IS NULL`, then `.in('person_id', members)` on activity). Works without changing the `activity` schema.
- Per-app organisation tab now renders this timeline instead of an EmptyState placeholder.

## [0.4.3] — 2026-05-15

### Added
- **Deploy-ready config.** `vercel.json` (repo root + `apps/web/`), `apps/api/Dockerfile` (multi-stage, repo-root build context for monorepo workspaces), `apps/api/fly.toml` (Frankfurt, scale-to-zero, health checks), `apps/api/.dockerignore`, and a full walkthrough in [`docs/deploy.md`](docs/deploy.md). Nothing was actually deployed — that needs dashboard access.

## [0.4.2] — 2026-05-15

### Added
- **Seed script** at `apps/api/scripts/seed-ebbf.mjs`. Creates the brief §8 worked example: EBBF Athens 2026 conference, post-Athens journey, board working session, 7 sample people, EBBF organisation with identity + system context + 3 members, ~11 enrolments, ~21 activity events spread across 90 days, per-app curator data for two key contacts. Idempotent — safe to re-run. Reads service key from `apps/api/.env`.
- Solves yesterday's "feels abstract" problem: every screen now renders real content.

## [0.4.1] — 2026-05-15

### Added
- **Programme + enrolment UI.** `/programmes` list, `/programmes/new` create form, `/programmes/[id]` detail with enrolments and Enrol-person dialog.
- API: `GET /api/v1/programs/:id` (detail), `GET /api/v1/programs/:id/enrolments` (with person info).
- `POST /api/v1/programs` now derives the owning app from the format (meeting → fibre-meet, event/journey → the-thread, *learn → fibre-learn) per brief §5 Domain 5.
- Sidebar gets a new "Programmes" section with Programmes + Activity.

## [0.4.0] — 2026-05-14

Brief revised to v0.4. Two structural principles formalised: **per-app profile tabs** and **the app justifies the field** (GDPR Article 5(1)(c) data minimisation).

### Schema (additive — nothing dropped, all reversible)
- Curator tables (`person_professional`, `person_relationship_context`, `person_change_context`, `person_learning`, `org_identity`, `org_system_context`, `org_relationship`) now carry an `app_id` FK declaring which app owns each row.
- Backfilled with sensible defaults: person_professional → fibre-platform, person_change_context → fibre-meet, person_learning → fibre-learn, person_relationship_context → fibre-sales, org_identity → fibre-platform, org_system_context → fibre-meet, org_relationship → fibre-sales.
- RLS rewritten to require `has_app_id(app_id)` — a user only sees curator rows for apps they have membership for. The principle is enforced at the database layer, not just the UI.

### API
- PATCH endpoints stamp the correct `app_id` server-side based on the endpoint.
- New: `GET /api/v1/persons/:id/apps` and `GET /api/v1/organisations/:id/apps` — returns the set of app slugs that have data on this entity (curator rows + activity events for persons). The UI uses this to render dynamic per-app tabs.

### UI
- Person profile now has: **Overview** → **Profile** (identity fields + Professional curator section) → one tab per app that has data.
- Organisation profile mirrors: **Overview** (basic identity + members) → **Profile** (org_identity curator) → per-app tabs.
- Old sub-routes are now redirect shims so existing bookmarks still work.
- `apps/web/lib/apps.ts` is the catalogue mapping each app slug → label and which curator sub-resources it owns.

### How this was built
Foundation by me sequentially. Two parallel sub-agents then refactored person and org profile pages on disjoint folders. Combined typecheck clean.

### Known gap (deferred)
- Activities filter by `organisation_id` isn't supported yet (`activity` schema only has `person_id`). Per-app org tabs render curator section + EmptyState for timeline. Future: join through `org_membership`.

## [0.3.11] — 2026-05-14

### Fixed
- **Page didn't refresh after save.** PATCH succeeded, dialog closed, but the read view stayed on the empty state because the dialog closes client-side and Next.js's `revalidatePath` from inside the server action didn't trigger the client to re-fetch. Now every edit dialog calls `router.refresh()` after a successful save, before closing — the page re-renders with fresh data immediately.

Applied to all 10 dialogs (contact + 4 person tabs, org + 3 org tabs, add-member).

## [0.3.10] — 2026-05-14

### Fixed
- Drop NOT NULL on `person_relationship_context.is_key_contact` and `is_ambassador`. They were `boolean NOT NULL DEFAULT false`; the UI sends `null` when the Yes/No select is left blank.
- Person `upsertProfile` helper now logs the full Postgres error (code/details/hint) to stderr and returns it in the 500 body — same pattern as v0.3.6's `upsertOrgProfile`. Future similar failures surface cleanly.

## [0.3.9] — 2026-05-14

### Fixed
- Relaxed `NOT NULL` on profile-table columns the UI treats as optional. The original schema had over-tightened these to `text[] NOT NULL DEFAULT '{}'` or `integer NOT NULL DEFAULT 0`. When the user cleared a value, the upsert rejected with `23502 null value in column "X" violates not-null constraint`. Defaults still apply on INSERT; `null` now means "unknown / not recorded" on clear.
  - text[]: `expertise_areas`, `industries_worked_in`, `certifications`, `spoken_at_events`, `change_themes`, `blockers`, `motivators`, `learning_interests`, `prior_programmes`, `stated_values`, `cultural_descriptors`, `languages_of_operation`, `active_change_themes`, `structural_tensions`, `previous_interventions`, `enablers`, `programmes_completed`, `operating_countries`, `languages_spoken`
  - integer: `total_participants_reached`, `touchpoints_count`

## [0.3.8] — 2026-05-14

### Fixed
- **The actual root cause of the silent saves.** `auth.users.id` (the JWT `sub` claim) is *not* the same as `public.user.id`. The API was using `ctx.userId = jwt.sub` for fields like `notes_updated_by`, `created_by`, etc. — all of which FK to `public.user.id`. Every such write failed with `23503 Key is not present in table "user"`.
  - Migration: `custom_access_token_hook` now injects `app_user_id` (the `public.user.id`) into JWT claims, and `public.current_user_id()` (used by RLS) reads from there.
  - API middleware: `ctx.userId` is now `app_user_id`; `ctx.authUserId` exposes the Supabase auth uuid separately for the few places that need it (none in app code yet).

This also retroactively fixes RLS policies on `user_identity_provider`, `session`, `app_membership`, `sso_match_log` that were silently denying queries because `current_user_id()` returned the wrong UUID.

### Action required
Users must **sign out and sign in** once to get a JWT with the new `app_user_id` claim. The API will return `401 invalid-claims` until then with a message telling them so.

## [0.3.7] — 2026-05-14

### Fixed
- **Profile-tab saves now actually persist.** The v0.3.6 fix (userClient apikey) made requests reach the database, which exposed the next bug: `parseList()` in the action helpers returned `null` for empty comma-separated inputs, but the `text[]` columns (`stated_values`, `expertise_areas`, `blockers`, `motivators`, …) are declared `NOT NULL DEFAULT '{}'`. Postgres rejected the insert with `null value in column "stated_values" violates not-null constraint`. Now `parseList` returns `[]` for empty input — applied to all 6 profile-tab actions (4 person, identity / system-context / relationship for org).

### Architecture note
This came out cleanly because the v0.3.6 `upsertOrgProfile` change started logging full Postgres errors (code, details, hint) to stderr — the actual constraint name was right there in the API server's terminal.

## [0.3.6] — 2026-05-14

### Fixed
- **Real cause of the silent saves: `userClient` was using the service-role key as its base apikey.** PostgREST then treats every request as `service_role`, ignoring the user's JWT claims for RLS. INSERTs/UPSERTs into `org_identity` etc. failed with a 500 because the JWT context wasn't applied correctly. Fixed by using the **anon key** as the apikey and overriding `Authorization` to forward the user JWT — the standard Supabase JS-on-the-server pattern.

This was the underlying cause of "save does nothing on Identity tab" — and likely several silent edge cases on other PATCH endpoints too.

### Added
- API: `upsertOrgProfile` now logs the full Postgres error (code/details/hint) to stderr before returning 500, and includes them in the response body for easier debugging.

## [0.3.5] — 2026-05-14

### Fixed
- **Save buttons (second pass).** v0.3.4 switched to `formRef.current.requestSubmit()` but Save was still doing nothing in practice. Now the button calls a `doSave()` function directly — it reads `FormData(formRef.current)` and invokes the server action without involving the form's submit event at all. `onSubmit` is kept as a fallback for the Enter key.

## [0.3.4] — 2026-05-14

### Fixed
- **Save buttons in all Edit dialogs now actually save.** Was: the submit `<Button>` lived in the Dialog footer (outside the form) and used `form="…-edit-form"` to point at the form. This is HTML-spec but unreliable in some browser/React combos — clicking Save did nothing. Now: each form uses a `ref`, and the Save button calls `formRef.current?.requestSubmit()` directly. Reliable everywhere.

Applies to all 9 Edit dialogs:
- Contact main (`contact-actions.tsx`)
- Contact tabs: Professional, Relationship, Change context, Learning
- Organisation main (`org-actions.tsx`)
- Organisation tabs: Identity, System context, Relationship
- Add member dialog on org detail

## [0.3.3] — 2026-05-14

Fixes the silent-save issue on edit dialogs.

### Changed
- **URL fields no longer require `https://` prefix.** Was: `z.string().url()` rejected `thefibre.app` or `linkedin.com/company/x` with a generic 400. Now: accept any string up to 500 chars; the display layer prepends `https://` when needed. Affects: organisation `website` + `linkedin_url`, person `linkedin_url`, user `avatar_url`.

### Fixed
- **All field errors now display.** Was: only `name` / `first_name` / `last_name` / `email` showed per-field errors — every other field surfaced only a generic "API 400" with no clue what to fix. Now: every input in both the contact and organisation Edit dialogs is wired to `state.fieldErrors`. If you mistype a country code or leave a malformed field, you'll see exactly which one.
- Country fields now include a hint ("Two letters or leave blank") so users don't accidentally type a single character.

## [0.3.2] — 2026-05-14

Organisation profile tabs — the org-graph counterpart to v0.3.0's person tabs.

### Added
- **Tabbed organisation detail** — `/organisations/[id]` now uses a layout with four tabs: Overview, Identity, System context, Relationship.
- **Identity** tab — mission, vision, stated values, cultural descriptors, governance model, ownership type, decision-making style, languages of operation, maturity stage, identity notes.
- **System context** tab — transformation stage, active change themes, structural tensions, strategic priorities, current challenges, **political landscape** (flagged Sensitive per brief §5.D3), leadership stability, change readiness, previous interventions, lessons, blockers, enablers.
- **Relationship** tab — relationship stage, health status, engagement type, programmes completed, total participants reached, touchpoints count, primary/secondary owner, last touchpoint, next planned contact, next opportunity, relationship history.
- **API:** GET + PATCH endpoints per tab (`/organisations/:id/{identity|system-context|relationship}`). Shared `upsertOrgProfile` helper.

### How this got built
Three parallel sub-agents, ~80 seconds wall-clock after the API + tab foundation was in place. Same pattern as v0.3.0.

## [0.3.1] — 2026-05-14

The relational glue between contacts and organisations.

### Added
- **Add member to org** — popup dialog on the org detail page with a person picker (dropdown of unaffiliated workspace contacts), title, department, employment type, influence, started date, and four flags (Primary / Decision maker / Budget holder / Champion). Writes to `org_membership`.
- **End membership** — inline button on each member row, opens a confirm dialog and stamps `ended_at` (soft end — historical link preserved per brief §5.D3).
- **API:**
  - `POST /api/v1/organisations/:id/members`
  - `POST /api/v1/organisations/members/:membership_id/end`

## [0.3.0] — 2026-05-14

Contact-graph deepening — the four profile sub-resources from brief §5.D2 are now editable in the UI.

### Added
- **Tabbed contact detail** — `/contacts/[id]` now has a shared layout (breadcrumb + header + tabs) with five tabs: Overview, Professional, Relationship, Change context, Learning. Each tab is its own route segment.
- **Professional** tab — title, department, seniority, sector, expertise areas, industries, years of experience, career stage, independent flag, certifications, events spoken at.
- **Relationship** tab — source, source detail, introduced by, strength, communication preference, best time, key-contact flag, ambassador flag, first contact at, first contact notes.
- **Change context** tab — role in change, stance, readiness, leadership style, change themes, blockers, motivators, current challenge, **facilitator notes** (flagged Sensitive per brief §5.D2; stamps `notes_updated_at` + `notes_updated_by` server-side).
- **Learning** tab — interests, prior programmes, learning style, group role tendency, open-to-coaching / peer-exchange, development goals, **post-programme reflection** (flagged Participant-owned per brief §5.D2).
- **API:** GET + PATCH endpoints per tab (`/persons/:id/{professional|relationship|change|learning}`). Shared `upsertProfile` helper. Strict Zod schemas covering every enum from the brief.
- **UI primitive:** `TabNav` in `components/ui/tabs.tsx`.

### How this got built
Four parallel sub-agents implemented one tab each, owning isolated folders. ~2.5 minutes total wall-clock for all four agents. Foundation (tab layout, stubs, API endpoints) was built sequentially first; then web-only tabs in parallel with no file overlap.

## [0.2.3] — 2026-05-13

### Added
- **Settings page** (`/settings`):
  - **Profile** form (full name, avatar URL) using the design-system primitives
  - Read-only details: email (managed by provider), sign-in method, last sign-in
  - **Workspace** card (name, slug, plan, created date) — multi-workspace switching noted as roadmap
  - **App access** list per `app_membership` with role
  - Link back to `/privacy`
- **API:**
  - `PATCH /api/v1/auth/me` — update own profile (full_name, avatar_url)
  - `GET /api/v1/auth/me` now also returns the workspace and `primary_auth_method` / `last_sign_in`

## [0.2.2] — 2026-05-13

### Added
- **Privacy page** (`/privacy`) — three sections:
  - **Active consents** with per-purpose Revoke buttons (only for `consent` legal basis; contract / legitimate_interest are noted but not revokable)
  - **Data subject requests** with status (Article 15/17)
  - **Actions** — Export (placeholder, Article 15 coming soon) + Request erasure dialog (Article 17 self-service)
- **API:**
  - `GET /api/v1/privacy/consent` — list the caller's own consent records
  - `GET /api/v1/privacy/requests` — list the caller's own data subject requests
  - `POST /api/v1/privacy/erasure-request` — `person_id` is now optional; defaults to the caller's own person (self-service)

## [0.2.1] — 2026-05-13

### Added
- **Edit / delete on organisations** — same Dialog + ConfirmDialog pattern as contacts
- **API:** `PATCH /api/v1/organisations/:id`, `DELETE /api/v1/organisations/:id` (soft delete)

## [0.2.0] — 2026-05-13

Design-system milestone. Single source of truth for buttons, fields, dialogs, list rows, and page chrome.

### Added
- **Edit / delete on contacts** — Pencil opens an Edit dialog (popup); Trash opens a Confirm dialog and soft-deletes via the API.
- **API:** `PATCH /api/v1/persons/:id` (partial update with strict Zod schema), `DELETE /api/v1/persons/:id` (soft delete via `deleted_at`).
- **UI primitives** under `components/ui/`:
  - `Button` + `ButtonLink` with variants (primary / secondary / ghost / danger), sizes, leading icon
  - `TextField`, `SelectField`, `TextAreaField` — single label/input/errors shell
  - `Dialog`, `ConfirmDialog` — popup pattern with Esc-to-close, click-outside-to-close, body-scroll lock
  - `PageContainer`, `PageHeader`, `Breadcrumb`, `SectionLabel`, `EmptyState`, `ErrorBanner`
  - `ListGroup` + `ListRow` — the repeated list pattern

### Changed
- All existing pages (dashboard, contacts list/detail/new, organisations list/detail/new) refactored onto the primitives. Tailwind class strings are no longer duplicated.
- Server actions for contacts unified under one `ActionResult` type with a shared error unwrapper.

### Note on history / undo
The 10-step undo idea is deferred — see conversation. Save / cancel / delete shipped first; history can layer in once we know which fields people actually change.

## [0.1.2] — 2026-05-12

### Added
- **Activity timeline** (`/activity`) — workspace-wide event log with type and app filters, cursor pagination
- **`fibre-platform` app slug** — the platform itself is now a registered app. Resolves the long-standing TODO of using `fibre-meet` as a placeholder.
- **`user_created` events** — written automatically when a person is created (in the API). Backfilled for existing users.
- API: `GET /api/v1/activities` now accepts either a UUID or a slug for `app_id` and joins the app name into responses

### Changed
- `lib/api.ts` `PLATFORM_APP_ID` switched from `fibre-meet` to `fibre-platform`
- `packages/shared` `APP_IDS` includes `fibre-platform`
- API middleware `VALID_APP_IDS` includes `fibre-platform`

## [0.1.1] — 2026-05-12

### Added
- **Organisations UI:** list with search (`/organisations`), detail page with members (`/organisations/[id]`), add-organisation form (`/organisations/new`)
- **Build tracking:** [CHANGELOG.md](./CHANGELOG.md) and [docs/build-plan.md](docs/build-plan.md) — version displayed in sidebar footer

## [0.1.0] — 2026-05-12

The end-to-end sign-in milestone. A real user can sign in with Google and land inside the app shell.

### Added
- **Auth:** Google OAuth via Supabase Auth. SSO match logic (`resolve_sso_identity`) creates platform `user` + `person` rows on first sign-in.
- **JWT claims:** custom access token hook injects `workspace_id` and `app_memberships` (slug array) into every JWT — required for RLS to work.
- **App shell:** sidebar with three modes (expanded / collapsed / expand-on-hover), top bar with avatar + user menu, theme switcher (light / dark / system) with cookie persistence and no-flash script.
- **Contacts UI:** list with search, person detail with activity timeline, add-person form via Server Action.
- **Schema:** identity + contact graph + RLS baseline; programme + enrolment + activity (append-only triggers); GDPR (consent_record, data_subject_request, retention_policy, processing_purpose).
- **API:** `/auth/me`, `/persons`, `/organisations`, `/activities`, `/programs`, `/privacy/consent`, `/privacy/erasure-request`, `/sso/resolve`.
- **Infrastructure:** Supabase project `the fibre` (West EU / Ireland), migrations tracked, deployed.

### Architecture
- Hard rule §13 holds: no personal data in Vercel. Every PII operation goes through the Hono API.
- Web pages under `app/(app)/` route group share one layout that enforces auth and renders the shell.

## [0.0.1] — 2026-05-12

Foundation.

### Added
- pnpm monorepo (`apps/web`, `apps/api`, `packages/shared`)
- Supabase project linked, region confirmed (West EU / Ireland)
- Phase 0 migration: identity, multi-tenancy, contact graph, RLS baseline
- Briefs saved under `docs/` (canonical project copy)
- GitHub remote: `findingthesoul/thefibre`
