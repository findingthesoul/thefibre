# Changelog

All notable changes to The Fibre. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [SemVer](https://semver.org/).

The displayed version comes from `apps/web/components/shell/sidebar.tsx`. Bump it whenever a change ships.

## [Unreleased]

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
