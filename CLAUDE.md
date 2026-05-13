# Working notes for Claude

Read this before doing anything. It's the orientation document for whoever (whatever) picks up this codebase next.

## Source of truth

- **Vision:** [`docs/fibre-technical-brief-v0.3.md`](docs/fibre-technical-brief-v0.3.md) — the canonical spec. Read §1 (vision), §2 (data wall), §13 (developer rules) before changing anything.
- **Operational plan:** [`docs/build-plan.md`](docs/build-plan.md) — what's queued, what's parked, gotchas, methodology.
- **Shipped record:** [`CHANGELOG.md`](CHANGELOG.md) — every version with its changes.

If those three contradict each other, the brief wins.

## Architecture in one paragraph

Hono API at `:8080` reads Supabase (EU). Next.js 15 web at `:3000` calls the API for everything — **no direct Supabase from web** (brief §13). User signs in via Google OAuth; Supabase Auth mints a JWT; the API trusts that JWT for tenant + user resolution. RLS is the enforcement layer; the API is a thin convenience wrapper. The data wall (brief §2): identity + contact graph live on the platform, app-specific content stays in each app. Apps cross the wall only via the `activity` event log (type + subject, never body).

## Hard rules — never violate

1. **No personal data in Vercel.** Frontend is stateless. Every PII operation goes through the EU API.
2. **`X-App-ID` header** on every API request.
3. **RLS on every table.** Workspace scoping mandatory. Test with a second workspace before shipping.
4. **Soft delete only** for personal data. `deleted_at` never `DELETE FROM`.
5. **Activity is append-only.** Type + subject only. Corrections = new rows.
6. **Cursor pagination only.** No offset.
7. **Connection pooling from day one.** Port 6543, transaction mode.

## Working with this codebase

### Version bumps
Every shipped change updates **four** `package.json` files plus `apps/web/app/(app)/layout.tsx` (the `VERSION` constant shown in the sidebar footer). The CHANGELOG entry lands in the same commit. SemVer: patch for additions/fixes, minor for milestones.

### Parallel agents
Used for v0.3.0 (4 person profile tabs) and v0.3.2 (3 org profile tabs). Works **only** when each agent owns a disjoint folder. Worktree isolation isn't available in this repo — agents share the working directory. The parent must do the foundation (layout, stubs, shared API) first; agents fill in leaves. After every batch: `pnpm -r typecheck` and a single commit. The Next.js dev server gets confused when many files arrive at once — kill and restart `pnpm dev` after a parallel batch.

### Debugging API failures
The biggest pain point this project has hit. Don't pattern-match — **read the API server log**. Both `upsertProfile` (persons) and `upsertOrgProfile` (orgs) now log full Postgres errors (code/details/hint) to stderr. The constraint name is right there. Use it.

If a user reports "save doesn't work", the diagnostic order is:
1. Check Network tab in Safari dev tools — does the PATCH request fire?
2. Check the API terminal stderr — what's the Postgres error?
3. Only THEN start hypothesising about what to fix.

### Versioning known gotchas (search the build plan for the full list)
- Supabase migration filenames need 14-digit timestamps. Same-day shorter prefixes collide.
- `custom_access_token_hook` must be enabled in the Supabase dashboard. Without it, RLS denies everything authenticated.
- JWT `sub` is `auth.users.id` — NOT `public.user.id`. Use `app_user_id` claim (since v0.3.8) for any FK to `user(id)`.
- text[] and integer counters were originally `NOT NULL DEFAULT`. They're now nullable (v0.3.9, v0.3.10) so the UI can clear them.
- `revalidatePath` from a server action doesn't auto-refresh the client route in this flow. Call `router.refresh()` from the dialog after a successful save (v0.3.11).

## State as of v0.3.11

**Shipped UI:**
- Identity + contact graph (persons, organisations) with full profile tabs per brief §5
- Edit + soft-delete on persons and orgs
- Add-member-to-org (link contacts to orgs with role + dates)
- Activity timeline (workspace-wide + per-person)
- Privacy page (consents + erasure request)
- Settings page (profile + workspace + app memberships)
- App shell with theme + sidebar preferences
- Sign-in end-to-end via Google OAuth

**Not yet shipped:**
- Public deploy. `thefibre.app` is still 404 — Vercel project exists but framework preset was wrong on last attempt.
- API deploy. Runs on user's laptop only.
- The four delivery apps (Fibre Suite, The Thread, Fibre Sales, Fibre Learn). Each only exists as an `app` row + tab placeholder.
- Programme + enrolment workflows (schema is in, UI is empty).
- Article 15 export, retention policy admin, cross-app erasure webhooks.

**What the platform feels like right now:** Largely empty. One user, one org, almost no activity events. The brief's "fullest picture of a human" only materialises once there's accumulated interaction history. Building more containers without filling them is what made the v0.3.x session feel abstract.

## Suggested next moves (operator's view)

In order of "biggest user-felt change per hour":

1. **Vercel deploy.** Even if hollow, having `thefibre.app` reachable changes the feeling from "side project" to "real thing". The framework-preset fix is small but blocks everything.
2. **Seed sample data.** A handful of realistic persons, an org with members, a programme with enrolments, a sprinkle of activity events across dates. Suddenly every screen has something to show.
3. **One end-to-end workflow.** Pick EBBF Athens (brief §8) — create the programme, enrol a few people, write a couple of session_attended events. Then walking the contact graph reflects the brief's vision instead of empty states.
4. **API deploy** — only meaningful if (1) is done.

Profile-tab refinements, tags, organisation relationships UI etc. are valuable but probably not what makes the product feel real.

## Reviewer's note

This session shipped twelve versions (0.3.0 → 0.3.11). The latter half was a debugging cascade on one feature (save buttons) that should have been resolved in one or two. Lesson logged: when a feature regresses in dev, **the API server log is the first stop**, not the fifth. The verbose error logging now in place makes the next regression cheaper.
