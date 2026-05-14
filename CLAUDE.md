# Working notes for Claude

Read this before doing anything. Orientation document for whoever picks up this codebase next.

## Source of truth

- **Vision (current):** [`docs/fibre-technical-brief-v0.4.md`](docs/fibre-technical-brief-v0.4.md) — the canonical spec. Read §1 (vision), §2 (data wall + profile structure), §5 (data model with app-owned curator extensions), §6 (data ownership + minimisation), §13 (developer rules), §15 (principles).
- **Previous brief:** [`docs/fibre-technical-brief-v0.3.md`](docs/fibre-technical-brief-v0.3.md) — kept in repo for traceability. **v0.4 supersedes for new work.**
- **Operational plan:** [`docs/build-plan.md`](docs/build-plan.md) — what's queued, what's parked, gotchas.
- **Shipped record:** [`CHANGELOG.md`](CHANGELOG.md).
- **Deploy procedure:** [`docs/deploy.md`](docs/deploy.md).

If those contradict each other, the brief wins.

## Architecture in one paragraph

Hono API at `:8080` reads Supabase (EU). Next.js 15 web at `:3000` calls the API for everything — **no direct Supabase from web** (brief §13). User signs in via Google OAuth; Supabase Auth mints a JWT; the API trusts that JWT for tenant + user resolution. RLS is the enforcement layer; the API is a thin convenience wrapper. The data wall (brief §2): platform owns identity + contact graph edges + activity events + enrolment state + consent. Each **app** owns its own content (separate schemas) AND the curator-data fields it justifies on persons/orgs (rows in shared tables tagged with `app_id`). Apps cross the wall only via the `activity` event log (type + subject, never body).

## Two principles formalised in v0.4

1. **Per-app profile tabs.** A person's or org's profile is composed of an Identity tab (Fibre Platform) plus one tab per app that has data on them. Tabs appear emergently from `GET /persons/:id/apps` and `/organisations/:id/apps`.
2. **The app justifies the field.** Every field stored exists because a specific app needs it. No "general useless stuff". RLS enforces this — a user only sees curator rows for apps they have `app_membership` for. GDPR Article 5(1)(c) by construction.

When designing a new field: which app justifies it? If none, don't add it.

## Hard rules — never violate

1. **No personal data in Vercel.** Frontend is stateless. Every PII operation goes through the EU API.
2. **`X-App-ID` header** on every API request.
3. **RLS on every table.** Workspace + (where applicable) app-membership scoping mandatory.
4. **Soft delete only** for personal data.
5. **Activity is append-only.** Type + subject only. Corrections = new rows.
6. **Cursor pagination only.**
7. **Connection pooling from day one** (PgBouncer transaction mode, port 6543).

## Working with this codebase

### Local dev

```bash
export PATH="$HOME/.local/bin:$PATH"
cd ~/Projects/thefibre
pnpm dev          # both API (:8080) and web (:3000) in parallel
```

### Version bumps
Every shipped change updates **four** `package.json` files plus `apps/web/app/(app)/layout.tsx` (the `VERSION` constant shown in the sidebar footer). The CHANGELOG entry lands in the same commit.

### Seed realistic data

```bash
cd apps/api && node scripts/seed-ebbf.mjs
```

Creates the brief §8 worked example: EBBF Athens 2026 conference + post-Athens journey + board working session, 7 people, EBBF org with members + identity + system context, ~11 enrolments, ~21 activity events spread across 90 days, per-app curator data for Marja and Daniel. Idempotent — safe to re-run.

### Parallel agents — when to use them

Worked well for v0.3.0 (4 person tabs), v0.3.2 (3 org tabs), v0.4.0 (person + org refactor). Rules:
1. Each agent owns a disjoint folder. No shared files.
2. The parent builds the foundation first — layout, stubs, shared API. Agents only fill leaves.
3. After every parallel batch: `pnpm -r typecheck`, then commit.
4. Sequential is faster for ≤2 tasks. Parallel pays off at 3+.

Worktree isolation isn't available in this repo — agents share the working directory. Strict file lanes prevent corruption. **The Next.js dev server gets confused when many files arrive at once** — kill and restart `pnpm dev` after a parallel batch.

### Debugging API failures

**Don't pattern-match — read the API server log.** Both `upsertProfile` (persons) and `upsertOrgProfile` (orgs) log full Postgres errors (code/details/hint) to stderr. The constraint name is right there. Order: Network tab in browser → API stderr → THEN hypothesise.

### Gotchas (from hard-won experience)

- Supabase migration filenames need 14-digit timestamps. Shorter prefixes collide same-day.
- `custom_access_token_hook` must be enabled in the Supabase dashboard. Without it, RLS denies everything authenticated.
- JWT `sub` is `auth.users.id` — NOT `public.user.id`. Use the `app_user_id` claim (added v0.3.8) for any FK to `user(id)`. The hook injects this.
- text[] and integer counters that were `NOT NULL DEFAULT` are now nullable so the UI can clear them.
- `revalidatePath` from a server action doesn't auto-refresh the client route in this flow. Call `router.refresh()` from the dialog after a successful save (added v0.3.11).
- `userClient` MUST use the anon key as base apikey, not the service-role key. Otherwise PostgREST elevates to service_role and ignores the user JWT for RLS (fixed v0.3.6).
- After parallel agent runs, the Next.js dev server can wedge. Kill + restart.

## State as of v0.4.3 (end of seeding + deploy-config session)

### What works end-to-end
- Sign in via Google → land on dashboard → see your apps
- Contacts (8 seeded people) → click one → Overview + Profile + per-app tabs that exist (Fibre Suite, Fibre Sales, Fibre Learn — emergent from actual data)
- Edit basic identity, edit per-app curator data. All saves persist.
- Organisations → EBBF → Overview + members + per-app tabs
- Programmes (3 seeded: Athens, post-Athens journey, board session) → enrol people → see enrolment list with status + progress
- Workspace-wide Activity timeline (~21 events across 90 days), filterable by app + type
- Privacy page (consents + erasure request)
- Settings page (profile + workspace + app memberships)

### Not yet shipped
- **Public deploy.** Configs are in place (`vercel.json`, `apps/api/Dockerfile`, `apps/api/fly.toml`). Run [`docs/deploy.md`](docs/deploy.md) — ~15 min. **This is the single biggest gap.**
- The four delivery-app frontends (suite.thefibre.app, thread.thefibre.app, sales.thefibre.app, learn.thefibre.app).
- Article 15 export, retention policy admin, cross-app erasure webhook handlers.
- Activity filter by `organisation_id` (only person_id today — org per-app tab timelines render EmptyState).
- Microsoft / LinkedIn OAuth.

### Data state
Workspace `eaf096f8…` (default), real user `sjoerd@soul.com`, 8 seeded sample people, 1 org (EBBF), 3 programmes, ~11 enrolments, ~21 activity events.

## Suggested next moves (in priority order)

1. **Deploy.** Follow [`docs/deploy.md`](docs/deploy.md). ~15 minutes. Public URL changes the feeling of the product from "side project" to "real thing".
2. **Activity filter by organisation_id.** Small API + UI change; unblocks org tab timelines.
3. **One delivery app frontend.** Pick The Thread (best-specified). A real `thread.thefibre.app` that writes `session_attended` events back through the platform demonstrates the full architecture.
4. **Microsoft + LinkedIn OAuth.** Supabase Auth config; new `user_identity_provider` rows. Trivial.
5. **Article 15 export.** GDPR table-stakes; the data is all there.
6. **Tags + person↔person relationships UI.**

## Reviewer's note

In v0.3.x I burned six versions chasing a single "Save doesn't work" bug because I pattern-matched instead of reading the API log. The verbose error logging in `upsertProfile` / `upsertOrgProfile` exists *because* of that. Use it. When something doesn't save: open `/tmp/api.log` (or wherever the API stderr is going) first, hypothesise second.
