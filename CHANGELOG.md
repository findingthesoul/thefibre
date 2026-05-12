# Changelog

All notable changes to The Fibre. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [SemVer](https://semver.org/).

The displayed version comes from `apps/web/components/shell/sidebar.tsx`. Bump it whenever a change ships.

## [Unreleased]

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
