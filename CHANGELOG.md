# Changelog

All notable changes to The Fibre. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [SemVer](https://semver.org/).

The displayed version comes from `apps/web/components/shell/sidebar.tsx`. Bump it whenever a change ships.

## [Unreleased]

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
- **`fibre-platform` app slug** — the platform itself is now a registered app. Resolves the long-standing TODO of using `fibre-suite` as a placeholder.
- **`user_created` events** — written automatically when a person is created (in the API). Backfilled for existing users.
- API: `GET /api/v1/activities` now accepts either a UUID or a slug for `app_id` and joins the app name into responses

### Changed
- `lib/api.ts` `PLATFORM_APP_ID` switched from `fibre-suite` to `fibre-platform`
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
