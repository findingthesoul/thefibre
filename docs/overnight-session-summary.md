# Overnight session summary — 2026-05-14 → 2026-05-15

Sjoerd went to sleep with full permission to push forward. Here's everything that shipped, in order.

## Versions shipped

| Version | What |
|---|---|
| **v0.4.0** | Brief v0.4: per-app profile tabs + data-minimisation principle. Migrations add `app_id` to seven curator tables and rewrite RLS to require `has_app_id`. API stamps `app_id` on writes; new `/apps` discovery endpoints. Person + org profile pages refactored to dynamic per-app tabs (built by two parallel sub-agents on disjoint folders). |
| **v0.4.1** | Programme + enrolment UI. List, detail with enrolments, create form. Enrol-person dialog. `POST /programs` derives owning app from format. Sidebar gets a "Programmes" section. |
| **v0.4.2** | Seed script — EBBF Athens 2026 worked example. 7 people, EBBF org, 3 programmes, ~21 activity events spread across 90 days. Idempotent. |
| **v0.4.3** | Deploy-ready config: `vercel.json` (both at repo root and apps/web/), `apps/api/Dockerfile`, `apps/api/fly.toml`, `apps/api/.dockerignore`. Full walkthrough in `docs/deploy.md`. |
| **v0.4.4** | Activity filter by `organisation_id` (joins through current org_membership). Per-app org tabs now render real timelines instead of EmptyState. |
| **v0.4.5** | Richer dashboard — stat cards (Contacts / Orgs / Programmes / Activity), recent activity, active programmes. Lands on substance. |

## Other artifacts

- `CLAUDE.md` rewritten to reflect v0.4
- `docs/build-plan.md` trimmed — "Now" is just the deploy walkthrough
- `docs/deploy.md` — full Vercel + Fly walkthrough; Sjoerd should be able to follow without questions
- `docs/ci-template/ci.yml` + README — GitHub Actions ready to install once a workflow-scoped token is available (active PAT lacked the scope)
- `CHANGELOG.md` backfilled for v0.4.1 through v0.4.5

## Working state at session end

- Both dev servers running, all 15 key routes return 200/307 as expected (no 500s)
- Typecheck clean across all three workspace packages
- All commits pushed to `github.com/findingthesoul/thefibre` main
- Web bundle builds successfully with placeholder env vars (CI-ready)
- Supabase database has 12 migrations, all applied, sjoerd's user has all 5 app_memberships

## What's blocking public visibility

Exactly one thing: running [`docs/deploy.md`](deploy.md). ~15 minutes of dashboard clicks (Vercel project settings + env vars + domain) + ~10 minutes of `fly` CLI commands. Everything else is configured and ready.

## Recommended first move when Sjoerd is back

Open [`docs/deploy.md`](deploy.md). Run through it. The platform becomes reachable.

If anything in the deploy walkthrough is unclear or breaks, that's the first thing to fix tomorrow morning — it's the only thing standing between this codebase and a live URL.
