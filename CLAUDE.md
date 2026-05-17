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
Every shipped change updates the **five** `package.json` files (web, api, meet, thread, shared) plus `apps/web/app/(app)/layout.tsx` (the `VERSION` constant shown in the Fibre sidebar footer). The CHANGELOG entry lands in the same commit.

**Meet has its own user-facing version** in `apps/meet/app/(app)/layout.tsx` — **decoupled from the monorepo cadence**. Meet is the rebuild of Suite v1, so its sidebar shows `v2.x`. Bump Meet's VERSION constant independently when Meet-specific surfaces ship, not in lockstep with platform-wide work.

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
- Supabase tracks applied migrations by filename, not checksum. Editing a previously-applied migration file is a no-op on remote — write a fresh migration to re-apply changes (see `20260514140000_relax_text_arrays_again.sql` for an example).
- `custom_access_token_hook` must be enabled in the Supabase dashboard. Without it, RLS denies everything authenticated.
- JWT `sub` is `auth.users.id` — NOT `public.user.id`. Use the `app_user_id` claim (added v0.3.8) for any FK to `user(id)`. The hook injects this.
- text[] and integer counters that were `NOT NULL DEFAULT` are now nullable so the UI can clear them.
- `revalidatePath` from a server action doesn't auto-refresh the client route in this flow. Call `router.refresh()` from the dialog after a successful save (added v0.3.11).
- `userClient` MUST use the anon key as base apikey, not the service-role key. Otherwise PostgREST elevates to service_role and ignores the user JWT for RLS (fixed v0.3.6).
- After parallel agent runs, the Next.js dev server can wedge. Kill + restart.
- `@thefibre/shared` emits a compiled `dist/` (since v0.4.8). Both apps must build it first. Done via the pnpm topological filter `--filter @thefibre/web... build` (the trailing `...` = "and its workspace dependencies"). Don't hand-chain build commands.
- Fly will refuse to release a machine lease until it expires (~15 min). If a deploy half-completes, you can't `fly machine destroy --force` it from a different token. Wait it out, then redeploy.

## Where we left off — 2026-05-17 (v0.13.11 · Meet 2.1.3)

Long sprint day. Three major slices landed since v0.10.0:

1. **Intake forms end-to-end** (v0.13.0) — editor + renderer + storage,
   answers attached to bookings.
2. **Paid bookings via Stripe Connect** (v0.13.1 → v0.13.7) — Connect
   onboarding (paste-flow), price on MT, Stripe Checkout for invitees,
   webhook completes deferred side-effects, 2% platform skim capped at
   €2 per booking (waived later by workspace plan). Branded booking
   emails. Several bug fixes around save flow (radio without `value`,
   revalidatePath cache, settings UX).
3. **Contact profile becomes truthful** (v0.13.8 → v0.13.11) — Meet's
   contact tab now shows only fields Meet justifies (`person_meet_profile`,
   not the change-facilitation set, which belongs to a future Fibre
   Change app). Profile gains Org memberships + Workspace access
   sections. App-access list filters by `workspace_app.deactivated_at`
   so dormant memberships don't render. Same fix applied to
   `/api/v1/auth/me` so the sidebar app switcher matches Settings → Apps.

Meet now has its own user-facing version (`v2.x` in the sidebar),
decoupled from monorepo cadence — it's the rebuild of Suite v1.

### Docs to read first
- `CHANGELOG.md` — v0.11 onwards is dense; v0.13.x is today.
- `docs/billing/` — platform billing roadmap + Stripe setup walkthrough
  (Sjoerd onboarded Stripe today).
- `docs/meet-architecture.md` / `meet-api.md` / `meet-data-model.md`.
- `docs/permission-tiers-proposal.md` (v0.9.0 decisions resolved).
- `docs/deploy.md` — note: `NEXT_PUBLIC_COOKIE_DOMAIN` must be set on
  *every* Vercel project (e5e68ab clarified this — a missing env on
  one app silently breaks cross-subdomain SSO).

### Recent commits to anchor on

```
d861cc0  v0.13.11 — dormant-membership fix on /api/v1/auth/me (sidebar/settings match)
438012e  v0.13.10 — fix: profile listed dormant app_memberships
d598a64  v0.13.9  — contact profile shows org + workspace + app memberships
870c151  v0.13.8  (Meet 2.1.3) — Meet contact tab uses person_meet_profile, not change-facilitation
bb1930a  v0.13.7  (Meet 2.1.2) — fix paid MT reverting to Free on save (radio value=)
968e7ec  v0.13.6  (Meet 2.1.1) — Payments save silently cached fix; settings 2-col grid
7ddb26e  v0.13.5  — Meet Phase 3: Stripe Checkout for paid bookings
6314c37  v0.13.1  — Phase 2: Stripe Connect (paste flow) + price on MT
9787509  v0.13.0  — Intake forms end-to-end; pricing/payments roadmap
fd14e13  v0.13.4  — branded booking emails; stop Google's duplicate invite
```

### Where The Fibre + Fibre Meet are right now

**Platform** (`thefibre.app`, v0.13.11)
- Sign-in: Google + 8-digit email code, on `/sign-in` (both web + meet).
- Auth emails routed through our API via Supabase Send Email Hook, rendered
  from `packages/shared/src/branding.ts`. Logo at
  `https://thefibre.app/brand/the-fibre.png`.
- Contact profile shows: identity → org memberships → workspace access →
  per-app curator tabs (only for activated apps) → activity timeline.
- Apps list / sidebar / settings all agree on which apps are activated
  for the workspace (workspace_app.deactivated_at IS NULL).

**Fibre Meet** (`meet.thefibre.app`, **v2.1.3** — versioned independently)
- Tabbed MT editor with Pricing tab fully wired: Free / Paid radio,
  price in cents, Stripe Connect required on workspace.
- Paid flow: invitee picks slot → booking row created with
  `payment_status='pending'` → redirected to Stripe Checkout (Connect
  Session against host's connected account, 2% capped at €2 application
  fee) → webhook fires `checkout.session.completed` → Google Calendar
  event + confirmation email + activity row run as deferred side-effects.
- Intake form editor (per-MT) + renderer on the public booking page +
  answers persisted to `meet_booking_intake`.
- Booking approval (host default + per-MT override) added in v0.13.2.
- Meet's contact tab shows only `person_meet_profile` (host notes, VIP,
  blocked, invitee timezone) + live upcoming/past bookings.
- Cream canvas (`bg-surface-sunken`), Lucide everywhere, Copy/Open icons
  on every meeting-type row, scope-team save fix all still in place.

### Infra invariants (don't regress)

- Fly machine pinned warm (`min_machines_running = 1`,
  `auto_stop_machines = off`) — Supabase auth hooks have a 5s ceiling.
- Auth-hook HMAC parser accepts `v1,whsec_xxx | whsec_xxx | bare base64`.
- Supabase OTP length is **8** — both `sign-in-button.tsx` files hardcode it.
- `NEXT_PUBLIC_COOKIE_DOMAIN` must be set on every Vercel project (web,
  meet, thread) — missing it on one app silently breaks cross-subdomain
  SSO. See `docs/deploy.md`.
- `branding.ts` is the SPoT. Public legal footer excludes `ENTITY.name`.
- React `<select>` pitfall: visible default ≠ state value. Always derive
  the posted value with a fallback (see Scope=Team fix from v0.10.x +
  the pricing radio fix in v0.13.7 — same shape, different mechanism).

### Two new design contracts pinned today

- **In-family apps use platform tables natively.** Meet/Thread/Flow
  share `person` / `team` / `workspace` directly. `app_entity_mapping`
  is for EXTERNAL apps only (think HubSpot, Notion). Don't reach for
  the mapping layer for first-party apps. See `design_in_family_apps_use_platform_natively.md`.
- **Suite → Meet cutover is a hard swap, no slug-preservation script.**
  Handle case-by-case if anyone screams. See `feedback_cutover_migration.md`.

### What's queued (priority order)

1. **Drop `person_change_context` table** (and Meet manifest reference).
   v0.13.8 stopped surfacing it; the table is dead weight. One migration.
2. **Sjoerd should add himself as an org member** on Solidarity Lab B.V.
   in the UI so his own profile's Organisations section populates
   (v0.13.10 note — the data wasn't wrong, the edge just didn't exist).
3. **Fibre Change app** — properly home the change-facilitation fields
   that v0.13.8 ejected from Meet. New app slug, manifest, curator
   tables, tab. Not started.
4. **Org-side per-app dialog labelling** — verify the org "Edit X"
   dialogs follow the same "Edit X — Fibre Sales" pattern that
   contacts do.
5. **Article 15 export / retention admin / cross-app erasure** — still
   not started.
6. **Group / One-off / Meeting poll** event types — still hard-coded
   `disabled: true` stubs in `new-menu.tsx`.
7. **Platform billing Phase 1** — workspace plan + plan-aware skim
   (waive 2% for Pro/Org). Roadmap doc lives in `docs/billing/`.

### Hot-button design feedback (still active)

- **Lucide icons, never emoji.**
- **Slug UX is centralised** in `apps/meet/components/ui/name-slug.tsx`.
- **Content left-aligned, not centered.**
- **Number-of-minutes fields are curated dropdowns**, not free-form inputs.
- **Personal vs Team is a 2-card chooser**, never a select.
- **Read the Suite source before reimplementing** — don't rebuild from a
  screenshot. Sjoerd's pinned note: "Suite was built in a week — by Claude.
  Don't excuse design fidelity with timing."

### Outstanding for Sjoerd (not code)

- _(Nothing outstanding as of v0.13.11. Stripe Connect onboarded today;
  Resend key rotated long ago.)_

---

## State as of v0.4.8 (live in production)

### Live URLs
- **Web** — https://thefibre.app (Vercel, fra1) and the project's preview deployments
- **API** — https://thefibre-api.fly.dev (Fly.io, fra region, 1 shared-cpu-1x 1GB machine)
- **DB + Auth** — Supabase project `zfsyyokepyycefbxiblc`, West EU (Ireland)
- Google OAuth signed-in user (sjoerd@soul.com) hits the real API; RLS scopes data; the 8 seeded contacts render.

### What works end-to-end
- Sign in via Google → land on dashboard → see your apps
- Contacts (8 seeded people) → click one → Overview + Profile + per-app tabs that exist (Fibre Meet, Fibre Sales, Fibre Learn — emergent from actual data)
- Edit basic identity (with searchable country picker, address, language), edit per-app curator data. All saves persist.
- Organisations → EBBF → Overview + members + per-app tabs (including invoicing on Fibre Sales)
- Programmes (3 seeded: Athens, post-Athens journey, board session) → enrol people → see enrolment list with status + progress
- Workspace-wide Activity timeline (~21 events across 90 days), filterable by app + type
- Privacy page (consents + erasure request)
- Settings page (profile + workspace + app memberships)

### Not yet shipped
- The four delivery-app frontends (meet.thefibre.app, thread.thefibre.app, sales.thefibre.app, learn.thefibre.app).
- Article 15 export, retention policy admin, cross-app erasure webhook handlers.
- Activity filter by `organisation_id` (only person_id today — org per-app tab timelines render EmptyState).
- Microsoft / LinkedIn OAuth.
- Custom `api.thefibre.app` CNAME (API is reachable at `thefibre-api.fly.dev` for now).
- Tightened CORS on the API — currently allows any origin (`apps/api/src/server.ts`).

### Data state
Workspace `eaf096f8…` (default), real user `sjoerd@soul.com`, 8 seeded sample people, 1 org (EBBF), 3 programmes, ~11 enrolments, ~21 activity events.

## Suggested next moves

Superseded by `docs/build-plan.md` (the "Open queue" section under "Where Fibre Meet is right now"). Highest-priority items today:
1. Magic-link auth (so non-Google invitees can sign in)
2. Fibre web: label per-app curator-data tabs by app name
3. Cutover plan for Meet ↔ Suite (Sjoerd owns)

## Reviewer's note

In v0.3.x I burned six versions chasing a single "Save doesn't work" bug because I pattern-matched instead of reading the API log. The verbose error logging in `upsertProfile` / `upsertOrgProfile` exists *because* of that. Use it. When something doesn't save: open `/tmp/api.log` (or wherever the API stderr is going) first, hypothesise second.
