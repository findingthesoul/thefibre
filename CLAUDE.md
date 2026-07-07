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
pnpm dev          # all five dev servers: api :8080, web :3000, meet :3001, thread :3002, flow :3003
```

### Version bumps
Every shipped change updates the **six** `package.json` files (web, api, meet, thread, flow, shared) plus `apps/web/app/(app)/layout.tsx` (the `VERSION` constant shown in the Fibre sidebar footer). The CHANGELOG entry lands in the same commit.

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
- Shared UI lives in `@thefibre/shared` too: `DateField`/`DateTimeField` (`src/ui/date-field.tsx`, subpath export `./ui/date-field`) - the app-local `components/ui/date-field.tsx` files are re-export shims. Edit the shared copy; per-app copies drifted once already (v0.13.104).
- `@thefibre/shared` emits a compiled `dist/` (since v0.4.8). Both apps must build it first. Done via the pnpm topological filter `--filter @thefibre/web... build` (the trailing `...` = "and its workspace dependencies"). Don't hand-chain build commands.
- Fly will refuse to release a machine lease until it expires (~15 min). If a deploy half-completes, you can't `fly machine destroy --force` it from a different token. Wait it out, then redeploy.

## Where we left off — 2026-07-07 (v0.13.108 · Thread 3.31.1 · Meet 2.4.1 · Flow 1.10.0)

**The Thread rebuild is COMPLETE** (2026-07-01 → 07-03, ~30 releases) and the
**Invoices + roles + payments-SPoT slice** landed right after. Everything
below is live (Vercel ×4 + Fly API + migrations applied).

### The Thread (thread.thefibre.app) — full feature set
Timeline editor (v3 style, no tabs), 8 engagement types, triggers
(fixed/relative/on_enrolment/on_approval/on_completion — ALL of them fire:
the in-API **message scheduler** runs every 5 min, dedup via
thread_message_send, 72h lookback), public pages + i18n ×5 (typed catalog,
missing translation = type error), tickets + discount codes (validated
server-side, public "Discount code?" reveal), **Stripe Checkout** (plan-aware
fee, auto legal invoice, embed-safe redirect) + **invoice method** (billing
fields incl. tax no., mark-paid, send-payment-link), approval + completion
flows (auto-issues certificates), certificates (builder, issuance, bulk
select→issue/print/email, LinkedIn add-to-profile, archive-if-in-use,
reissue keeps number+date), thread templates (full duplicates, editable
content, New-thread hover menu), /my portal (Google + 8-digit code, activity
trail, consent-gated cohort), Webflow embeds (list/thread/enrol-popup,
data-lang, data-workspace, popup interaction, custom CSS via te-* classes +
<style>-inside-the-div lift, code generator in Settings → Website embeds).

### Platform: invoices, roles, payments SPoT (v0.13.93-95+)
- **purchase ledger** — 2nd sanctioned data-wall crossing (after activity).
  Meet + Thread write at money events; backfilled. docs/invoices-and-roles-proposal.md
  (all 4 decisions accepted as recommended).
- **Roles**: workspace_role ∈ super_admin | admin | organiser (facilitator
  stays PER-THREAD). RLS helpers widened; current_workspace_role() exists.
  Members UI still shows old labels (open task).
- **Invoices page** in Thread + Meet sidebars: scope Me/Team/Workspace
  (workspace = admin+), app filter chips, search, totals, detail dialog with
  Reimburse (full, fee returned) / Mark paid / Send payment link / Resend
  invoice (receipt-styled emails w/ seller block).
- **Connections SPoT** (v0.13.107): user_connection.{google_refresh_token,
  personal_room_url} — service-role-only table (credential; NOT on the
  workspace-readable user_profile). ALL readers via
  apps/api/src/lib/connections.ts (meet_host columns are read fallbacks —
  never write them again; saves clear them).
- **Payments SPoT**: user_profile.{stripe_account_id, invoice_details,
  default_payment_methods} + workspace.{stripe_account_id, invoice_details}.
  ALL readers go through apps/api/src/lib/payment-accounts.ts (platform value
  first, old app-local columns as read fallback). Settings → Payments in
  Thread AND Meet write the platform endpoints (/api/v1/profile,
  /api/v1/workspace-billing). Old columns (meet_host/thread_organiser/
  thread_settings .stripe_account_id) are FALLBACKS — never write them again.
- **Payment-method inheritance**: account default → thread → ticket (null =
  inherit at each level); resolved server-side incl. the public payload.
- **Accounts auto-create at enrolment** (email-only; OTP/Google verify at
  sign-in) — the enrol form says "Sign in to your personal page".

### ⚠️ Outstanding for Sjoerd (not code)
1. **Register the Thread Stripe webhook**: endpoint
   `https://thefibre-api.fly.dev/api/v1/thread/stripe-webhook`
   (checkout.session.completed + .expired) and
   `fly secrets set STRIPE_THREAD_WEBHOOK_SECRET=whsec_…`.
   Until then paid checkouts never confirm.
2. Test purchase end-to-end (invoice path works without the webhook).
3. Add himself as org member on Solidarity Lab B.V.

### Open queue (docs/build-plan.md is the SPoT)
- Members UI role vocabulary (API accepts super_admin/admin/organiser).
- €0-with-code enrolments in the ledger? (decision pending)
- Org-share money transfers (thread_payout ledger exists; transfers deferred)
- Certificate email i18n (EN-only), Stripe customer_tax_ids alignment
- Platform queue: Fibre Change app, Article 15 export, Meet event-type stubs,
  billing next phases, role-gating other surfaces (proposal §3.8)

### Gotchas added this sprint
- **The dialog bottom bar is a Fibre-wide contract** (Delete·Duplicate left,
  Cancel·Save right, footer submits by form id). All four apps comply; Flow
  now has components/ui/{dialog,button}.tsx (ported from Thread).
- Coupon codes compare case-insensitively (ilike, no wildcards).
- Public organiser-slug queries MUST filter `.is('team_id', null)` — team
  threads live under the TEAM slug (also in every public URL builder).
- purchase writes are update-first-insert-second on (app_id, item_ref) —
  webhook retries and double-submits are safe.
- The scheduler + webhook + payment link all converge on
  finalizePaidEnrolment / sendTriggeredMessages — extend those, don't fork.

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
- ~~The delivery-app frontends~~ Meet, Thread and Flow are live (see "Where
  we left off" above); Fibre Sales and Fibre Learn remain unbuilt.
- Article 15 export, retention policy admin, cross-app erasure webhook handlers.
- Activity filter by `organisation_id` (only person_id today — org per-app tab timelines render EmptyState).
- Microsoft / LinkedIn OAuth.
- Custom `api.thefibre.app` CNAME (API is reachable at `thefibre-api.fly.dev` for now).
- ~~Tightened CORS~~ done in v0.13.17 — allowlist in `apps/api/src/server.ts`.

### Data state
Workspace `eaf096f8…` (default), real user `sjoerd@soul.com`, 8 seeded sample people, 1 org (EBBF), 3 programmes, ~11 enrolments, ~21 activity events.

## Suggested next moves

Superseded by `docs/build-plan.md` (the "Open queue" section under "Where Fibre Meet is right now"). Highest-priority items today:
1. Magic-link auth (so non-Google invitees can sign in)
2. Fibre web: label per-app curator-data tabs by app name
3. Cutover plan for Meet ↔ Suite (Sjoerd owns)

## Reviewer's note

In v0.3.x I burned six versions chasing a single "Save doesn't work" bug because I pattern-matched instead of reading the API log. The verbose error logging in `upsertProfile` / `upsertOrgProfile` exists *because* of that. Use it. When something doesn't save: open `/tmp/api.log` (or wherever the API stderr is going) first, hypothesise second.
