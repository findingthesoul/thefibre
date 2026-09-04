# Working notes for Claude

Read this before doing anything. Orientation document for whoever picks up this codebase next.

## Source of truth

- **Vision (current):** [`docs/fibre-technical-brief-v0.4.md`](docs/fibre-technical-brief-v0.4.md) — the canonical spec. Read §1 (vision), §2 (data wall + profile structure), §5 (data model with app-owned curator extensions), §6 (data ownership + minimisation), §13 (developer rules), §15 (principles).
- **Previous brief:** [`docs/fibre-technical-brief-v0.3.md`](docs/fibre-technical-brief-v0.3.md) — kept in repo for traceability. **v0.4 supersedes for new work.**
- **Operational plan:** [`docs/build-plan.md`](docs/build-plan.md) — what's queued, what's parked, gotchas.
- **Shipped record:** [`CHANGELOG.md`](CHANGELOG.md).
- **Deploy procedure:** [`docs/deploy.md`](docs/deploy.md).
- **App contract:** [`docs/building-on-the-fibre.md`](docs/building-on-the-fibre.md) — what every app, in-family or external, has to know and obey. Read §6 before touching anything under `/api/v1/apps/*`.

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
8. **`/api/v1/apps/*` is additive-only.** It is a published contract that apps
   outside this repo are written against, deliberately not the shape of our
   tables. Add response fields; never rename, remove, retype or re-mean one —
   including semantically (making `status` mean something new breaks a caller
   as hard as deleting it). `scripts/verify-external-app.mjs` step 7b asserts
   every published shape and will fail you. If a break is truly unavoidable,
   add a versioned path alongside; don't change the old one.

## Working with this codebase

### Local dev

```bash
export PATH="$HOME/.local/bin:$PATH"
cd ~/Projects/thefibre
pnpm dev          # all seven dev servers: api :8080, web :3000, meet :3001, thread :3002, flow :3003, pulse :3004, membership :3005
```

### Version bumps
Every shipped change updates the **nine** `package.json` files (root, web, api, meet, thread, flow, pulse, membership, shared) plus `apps/web/lib/version.ts` (the `VERSION` constant shown in the Fibre sidebar footer and on Settings → How The Fibre works; it moved out of `layout.tsx` in v0.17.1 so more than one surface could read it). The CHANGELOG entry lands in the same commit.

**Meet has its own user-facing version** in `apps/meet/app/(app)/layout.tsx` — **decoupled from the monorepo cadence**. Meet is the rebuild of Suite v1, so its sidebar shows `v2.x`. Bump Meet's VERSION constant independently when Meet-specific surfaces ship, not in lockstep with platform-wide work. **Pulse likewise** has its own `VERSION` in `apps/pulse/app/(app)/layout.tsx` (new app, started at 0.1.0 on 2026-07-07). **Membership likewise** — its own `VERSION` in `apps/membership/app/(app)/layout.tsx` (new app, started at 0.1.0 on 2026-09-04; display name may become "Hyve" — the slug `membership` never changes, only branding.ts does).

### Seed realistic data

```bash
cd apps/api && node scripts/seed-ebbf.mjs
```

Creates the brief §8 worked example: EBBF Athens 2026 conference + post-Athens journey + board working session, 7 people, EBBF org with members + identity + system context, ~11 enrolments, ~21 activity events spread across 90 days, per-app curator data for Marja and Daniel. Idempotent — safe to re-run.

### Components first (Sjoerd, 2026-09-05 — binding)

Before building ANY UI surface: check `packages/shared/src/ui` and the
other five apps. If it exists anywhere, use the shared component — or
extract it to `packages/shared` and port the copies. **Never fork a new
per-app variant.** New recurring surfaces are BORN in `@thefibre/shared`
with the app-bound pieces (apiFetch, server actions) injected as props
(see `ui/invoices.tsx` for the pattern). When copies disagree, Thread is
design-leading. Two companions: ordering UIs are drag-and-drop, never a
numeric sort field; dates always use the shared `DateField`, never a
native `<input type="date">`.

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

## Where we left off — 2026-09-01 (v0.21.0)

**Productisation shipped in two slices** (docs/productisation-proposal.md is
the umbrella; docs/pricing-proposal.md holds the decided numbers — Free /
Starter €19 / Pro €49 / Enterprise POA, per workspace):

- **/admin/plans** — editable tier matrix (prices monthly+yearly, allowances,
  fee ladder, feature checkboxes grouped by app). Edits the same
  `billing_plan` rows `lib/plan.ts` gates on; new feature KEYS stay a deploy.
- **Settings → Plan** (fibre web) — current plan incl. comped/tailored
  badges, usage, catalogue, upgrade/portal buttons. The other apps' settings
  hubs link to it ("in The Fibre").
- **/pricing** (public) + landing trial chip + app-family section. Catalogue
  comes from no-auth `GET /api/v1/public/plans`; canonical order via
  `sortPlans` (free→starter→pro→org, never by price).
- **/admin/workspaces** — real plan shown (never legacy `workspace.plan`,
  which is now fully dead: unread AND unwritten), Plan… dialog (move plan,
  comp with reason, tailored `custom_price_cents_month/year`), New workspace
  button (the invited-in door for social enterprises).
- **Stripe Billing** — routes/billing.ts (subscription checkout, portal,
  webhook w/ own `STRIPE_BILLING_WEBHOOK_SECRET`), sync-stripe-plans.mjs.
  Paid subscription invoices land in the purchase ledger as `fibre-platform`
  rows. **BLOCKED on Sjoerd: no STRIPE_SECRET_KEY exists on Fly at all**
  (Meet/Thread checkout 503 in prod too) — steps in
  docs/platform-billing-setup.md.
- **/admin/economics** — MRR/ARR, by-plan, comps w/ reasons, 30/90d ledger
  income, signup pipeline. Platform tables only; costs live in Pulse
  (seed-operating-costs.mjs, run 2026-09-01: ~€79/mo as budget lines in
  Solidarity Lab).
- Approval email now actually sends (lib/email/platform-templates.ts).

Rules that follow: super-admin checks go through `lib/super-admin.ts`;
`forgetAllPlans()` after any billing_plan write; prices (incl. tailored)
never gate features — gates always follow `plan_id`.

Open: P4 (metered overage, seat enforcement on invite, 13-month Free
archive) and P5 (product pages, OG image, self-serve flip) in the proposal;
build-plan.md Open queue is groomed.

---

## Where we left off before that — 2026-08-22 (v0.14.0)

**The platform now hosts apps written outside this monorepo.**
`docs/brief-external-apps.md` (written from a real, half-failed attempt to
integrate the Festival of Trust planner) is shipped whole except the
curator-data write API.

Three things changed, and the first is the one that mattered:

1. **The app catalogue is open.** `public.app.slug` carried an allow-list, so
   every app since phase 0 registered itself by dropping the constraint,
   inserting, and re-adding it — i.e. **registering an app was a schema
   migration against the platform database**. Slugs are now validated by
   format; the guard moved onto the row as `status` (pending → approved →
   suspended) + `kind` + `manifest`, reviewed at **/admin/apps**, shaped after
   `signup_request`. `POST /api/v1/apps/register` is public.
2. **`app_key`** — a credential scoped to (app × workspace). Before it, an
   external app used a *user-scoped* JWT from a live browser session: no
   background sync, and the app held the user's full authority everywhere.
   Token returned once, sha256 stored. Minted at Settings → Apps → Manage API
   keys.
3. **Scopes are enforced.** A key can't carry a scope its manifest didn't ask
   for; an app key reaches an explicit route allow-list in
   `middleware/app-context.ts` and nothing else (default deny). `/persons` and
   `/organisations` stay unreachable — they run on a user's RLS identity.

Plus: organisation links (was person-only), `links:bulk`, `PUT
/apps/:slug/manifest`, `GET /apps/whoami`, and activity types validated against
the manifest.

**`apps/api/scripts/verify-external-app.mjs` is the brief's six-step
verification, runnable.** Run it after touching anything in this area — it uses
a throwaway slug and cleans up.

### Rules that follow from this
- **Never re-add a slug allow-list.** If you're tempted to hardcode "which apps
  exist" anywhere — SQL, API, or a web page — that's the bug this release
  removed. Ask the catalogue.
- **An app key context has no user.** `ctx.userId` is `''`; use
  `actorUserId(ctx)` for any user FK, and filter `workspace_id` explicitly on
  every query, because RLS is not doing it for you.
- Adding a scope is a deploy (`lib/app-keys.ts`), not a migration. On purpose.

---

## Where we left off before that — 2026-07-07 (v0.13.108 · Thread 3.31.1 · Meet 2.4.1 · Flow 1.10.0)

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

### Gotchas added in v0.14.0
- The `app` read policy hides pending/suspended apps from ordinary users. If a
  lookup by slug suddenly 404s for one user and not another, check `status`.
- `workspace_app_approved_gate` is a trigger, not a CHECK — a CHECK can't reach
  another table. It only fires for rows that end up ACTIVE, so deactivating a
  suspended app still works (otherwise a suspension traps the workspace).
- Hono routes a literal `links:bulk` segment fine; both it and `links/bulk` are
  registered.
- `is_super_admin()` is used inside the `app` policy. It reads `public."user"`,
  whose own policy only touches JWT claims — no recursion. Keep it that way.

### Gotchas added in the invoices/roles sprint
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
