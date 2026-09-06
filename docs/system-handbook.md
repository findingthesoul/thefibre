# The Fibre — System Handbook

**Audience:** a programmer (very likely working with an LLM assistant) who has
never seen this codebase and needs to make a correct change to it. This is the
orientation document: architecture, structure, design rules, conventions,
version management, environments, and where everything lives. It links out to
the deeper documents rather than duplicating them.

**State as of v0.52.0 (2026-09-07).** If this document and
`docs/fibre-technical-brief-v0.4.md` disagree, the brief wins on vision and
data-model intent; this handbook wins on operational facts (domains, env vars,
release procedure), because it is groomed on every ship.

---

## 1. What this is

The Fibre is a **GDPR-native relationship platform** operated by Solidarity
Lab B.V. (Rotterdam, EU-hosted). It is one product family:

- **The Fibre** (`fibre-platform`) — the backstage platform: identity,
  contacts, organisations, programmes, activity, consent, workspaces,
  billing, admin. https://thefibre.app
- **Thread** (`the-thread`) — the flagship: learning journeys / events —
  public enrolment pages, tickets, payments, scheduled messages,
  certificates, participant portal (`/my`), website embeds.
  https://app.thethread.app
- **Meet** (`fibre-meet`) — scheduling/booking (rebuild of the old "Suite").
  https://meet.thethread.app
- **Flow** (`fibre-flow`) — people-flow state machine (pipelines, gates,
  tasks, visual builder). https://flow.thethread.app
- **Pulse** (`fibre-pulse`) — business planner / cashflow.
  https://pulse.thethread.app
- **Membership** (`membership`) — community subscriptions (tiers, renewals,
  access grants, Circle/Google Workspace integrations; display name may
  become "Hyve" — only branding changes, never the slug).
  https://membership.thethread.app
- `fibre-sales`, `fibre-learn` — registered slugs, **not built**
  (`available: false` in the registry).

**Two apex domains, deliberately** (since v0.52.0, the "branding pivot"):
fibre web lives on `thefibre.app`; the five delivery apps live on
subdomains of `thethread.app` (Thread takes `app.`). The `thethread.app`
apex itself serves the old standalone Thread V3 landing page (separate
repo/Vercel project, being decommissioned — the landing must keep serving).
Sessions cross the two apexes via the SSO hop (§6.3). Naming rationale:
`docs/naming-brief.md`.

---

## 2. Architecture in one paragraph

A single **Hono API** (`apps/api`, port 8080, deployed on Fly.io) fronts a
**Supabase** Postgres+Auth project (EU/Ireland). Six **Next.js 15** apps
(App Router, React 19) call the API for everything — **no app ever talks to
Supabase data directly; only Supabase *Auth*** (sign-in, session cookies).
The API is a thin convenience layer; **Row-Level Security is the real
enforcement layer**. Users sign in via Google OAuth or email OTP through
Supabase Auth; the API verifies the resulting JWT statelessly (JWKS) and a
custom access-token hook stamps workspace/membership claims into it. The
frontends are stateless (Vercel, `fra1`) and hold **no personal data** —
every PII operation crosses into the EU API.

### The data wall (brief §2)

The platform owns: identity (person/organisation), the contact graph,
activity events, enrolment state, consent. Each app owns its own content in
its own table namespace (`thread_*`, `meet_*`, `flow_*`, `pulse_*`,
`membership_*`) **plus** the curator-data fields it justifies on shared
person/org tables (rows tagged `app_id`; RLS shows them only to members of
that app). Apps cross the wall in exactly **two sanctioned places**:

1. `activity` — append-only event log (type + subject, never content).
2. `purchase` — the money ledger (§8).

**"The app justifies the field"**: no field exists on the platform without a
registered app that needs it. When designing a field, name the app; if you
can't, don't add it.

### Request flow

```
Browser ──cookie──▶ Next.js app (server component / server action)
                      │  reads Supabase session cookie server-side
                      ▼
                    apiFetch(): Authorization: Bearer <jwt> + X-App-ID
                      ▼
                    Hono API (Fly, :8080)
                      │  middleware/app-context.ts: JWKS-verify, resolve
                      │  workspace + user, build RequestContext
                      ▼
                    Supabase Postgres via userClient(jwt) → RLS applies
                    (adminClient = service-role, only for webhooks/
                     platform-internal work, always with explicit filters)
```

---

## 3. Repository structure

pnpm monorepo (`pnpm-workspace.yaml`), TypeScript everywhere.

```
apps/
  api/            Hono API (the only thing that touches data)
    src/routes/   one file per resource domain (~36 files)
    src/lib/      cross-route logic: payments, email, plans, fees, google…
    src/middleware/app-context.ts   auth + tenancy + app-key gate (§6.4)
    scripts/      seed-ebbf.mjs, verify-external-app.mjs,
                  verify-public-api.mjs, sync-stripe-plans.mjs, …
  web/            The Fibre (fibre-platform)     :3000
  meet/           Meet                           :3001
  thread/         Thread                         :3002
  flow/           Flow                           :3003
  pulse/          Pulse                          :3004
  membership/     Membership                     :3005
packages/
  shared/         @thefibre/shared — THE shared package (§5)
supabase/
  migrations/     146+ SQL migrations — the schema's single source of truth
docs/             briefs, proposals, runbooks (§12 doc map)
scripts/          repo-level ops: verify-vercel-env.mjs, vercel-ignore.mjs,
                  smoke-staging.mjs, db-push-{prod,staging}.sh
CLAUDE.md         working notes for LLM sessions (gotchas, where-we-left-off)
CHANGELOG.md      the shipped record — every release has an entry
docs/build-plan.md  the Open queue — THE to-do list, groomed on every ship
```

Each Next.js app has the same internal shape: `app/` (App Router;
`(app)/` = signed-in chrome with sidebar/topbar, everything else public),
`components/shell/` (thin shims over shared chrome), `lib/`
(`api.ts` = apiFetch, `supabase/{client,server}.ts`, `prefs*.ts`,
`available-apps.ts`, `locale.ts`, `i18n-ui.ts`). Several `lib/` files are
**byte-identical across all six apps by design** — if you change one, change
all six identically (check with `md5 -q apps/*/lib/<file>`).

---

## 4. Database & RLS

- **Migrations only.** Schema lives in `supabase/migrations/*.sql`,
  timestamped `YYYYMMDDHHMMSS_name.sql` (14 digits — shorter prefixes
  collide same-day). Supabase tracks applied migrations **by filename** —
  editing an applied file is a silent no-op on remote; write a new
  migration instead.
- Apply with `bash scripts/db-push-prod.sh` and `db-push-staging.sh`
  (they link the right project, push, and relink prod).
- **RLS on every table.** Workspace-scoping mandatory; app-membership
  scoping where curator data is involved. Helper functions exist
  (`current_workspace_role()`, `is_super_admin()` — the latter reads
  `public."user"` whose own policy touches only JWT claims; keep it
  non-recursive).
- **Service-role-only tables** (credentials and machine state): RLS enabled
  with **no policies**, all access through the API's `adminClient` with
  explicit filters — `oauth_client`, `oauth_code`, `sso_handoff`,
  `user_connection`, `membership_settings`, `app_key`, etc.
- **Soft delete only** for personal data (`deleted_at`). Activity is
  append-only; corrections are new rows.
- **Cursor pagination only.** Never offset.
- Table namespaces: platform (`person`, `organisation`, `workspace`,
  `user`, `activity`, `enrolment`, `consent_record`, `billing_plan`,
  `purchase`, `signup_request`, …) and per-app prefixes (`thread_*`,
  `meet_*`, `flow_*`, `pulse_*`, `membership_*`). In-family apps use
  platform tables **natively**; `app_entity_mapping` is for EXTERNAL apps
  only.
- JWT `sub` is `auth.users.id`, **not** `public.user.id`. Use the
  `app_user_id` claim (injected by `custom_access_token_hook` — which must
  be enabled in the Supabase dashboard, else RLS denies everything) for
  any FK to `user(id)`.
- `userClient()` **must** use the anon key as base apikey and forward the
  user JWT — service key as apikey silently elevates past RLS
  (`apps/api/src/db.ts` documents this).

---

## 5. The shared package — `@thefibre/shared`

`packages/shared` compiles to `dist/` (plain `tsc`); every subpath is an
explicit `exports` entry in its `package.json`. Apps depend on the build —
`pnpm --filter @thefibre/web... build` (the trailing `...` builds
dependencies first; never hand-chain builds).

The load-bearing modules:

| Module | What it is |
|---|---|
| `branding.ts` | **THE domain/name registry.** `APPS[slug]` = name, tagline, `url` (prod default), `urlEnv` (env override key), `available`. `appUrl(slug, env)` is the only correct way to build an app URL. `ENTITY`, `FOOTER_LINKS`, `BRAND_ASSETS` (email chrome — deliberately stays on thefibre.app). A rename or domain move is this file + env. |
| `sso-hop.ts` | Cross-apex SSO (§6.3): `crossAppHref()`, `createSsoHop/Land()`. |
| `auth-callback.ts` | `createAuthCallback()` — the shared OAuth/OTP callback flow (five apps wire it; **web still has its own richer copy** with signup-status branches — fold before touching callbacks). |
| `embed-loader.ts` | `buildEmbedLoader()` — origin-relative website-embed loader; Thread + Membership serve it at `/embed.js`. Iframe origin derives from the pasted `<script src>`; postMessage is origin-checked. Embeds are deliberately iframes (`docs/…` decision, don't propose web components again). |
| `prefs.ts` | Cross-app preference cookie names/types. |
| `i18n.ts`, `ui/i18n-ui.tsx`, `chrome-server-i18n.ts` | Six locales (en, nl, de, fr, es, el), **typed catalogs** — a missing translation is a type error. `// MT` marks machine drafts. |
| `ui/*` | The shared component library: app-switcher, topbar, sidebar-shell, user-menu, bottom-nav (mobile tab bar), dialog, button, fields, DateField/DateTimeField, settings, invoices, profile-form, toast, … |

**Components-first rule (binding):** before building ANY UI surface, check
`packages/shared/src/ui` and the other five apps. Use or extract the shared
component; **never fork a per-app variant**. New recurring surfaces are BORN
in shared with app-bound pieces (apiFetch, server actions) injected as props
(`ui/invoices.tsx` is the pattern). Thread is design-leading when copies
disagree. Ordering UIs are drag-and-drop (never a numeric sort field); dates
always use the shared `DateField` (never a native `<input type="date">`).
The dialog bottom bar is a fibre-wide contract: Delete·Duplicate left,
Cancel·Save right, footer submits by form id.

---

## 6. Identity, sessions, and auth

### 6.1 Sign-in

Supabase Auth: Google OAuth (`prompt: select_account`) or email OTP
(8-digit code). Every app's `sign-in-button.tsx` builds
`redirectTo = ${window.location.origin}/auth/callback` — origin-relative,
nothing hardcoded. The callback (shared factory, §5) exchanges the PKCE
code, then calls the API's `/api/v1/sso/access-check` and `/sso/resolve`
(server-to-server, `X-SSO-Secret` header = `SSO_INTERNAL_SECRET`) to map
the auth identity to a platform user/workspace, then `refreshSession()` so
the access-token hook stamps claims. Participants (Thread `/my`, Membership
portal) are ordinary Supabase users with **no workspace membership** — the
callback's `publicPrefixes` option skips the access gate for those paths.
Accounts auto-create at enrolment (email-only; verified at first sign-in).

External registrations: Google Cloud Console holds ONE redirect URI (the
`…supabase.co/auth/v1/callback`) — app domains appear only as authorized
JS origins + consent-screen domains. The Supabase dashboard's Redirect URLs
allowlist must contain each apex wildcard (`https://thefibre.app/**`,
`https://*.thefibre.app/**`, `https://*.thethread.app/**`).

### 6.2 Session sharing within an apex

`@supabase/ssr` cookies, chunked `sb-<ref>-auth-token`, with
`Domain = NEXT_PUBLIC_COOKIE_DOMAIN`. Production: `.thefibre.app` on the
web project, `.thethread.app` on the five delivery apps; staging
`.thefibre.tech`; local unset. Within an apex, sign-in on one app IS
sign-in on all (silent SSO — the cookie just travels). The same env var
scopes the **preference cookies** (`thefibre.theme`, `thefibre.sidebar`,
`thefibre.locale`) written by the `savePref` server action
(`lib/prefs-actions.ts` — server action on purpose: Safari ITP caps
JS-set cookies at 7 days; not httpOnly because the no-flash `ThemeScript`
reads it pre-paint).

**Trap:** a wrong cookie domain surfaces as `"PKCE code verifier not
found"` on sign-in, not as a cookie error. `scripts/verify-vercel-env.mjs`
machine-checks the per-project expectation.

### 6.3 Session crossing between the two apexes — the SSO hop

A cookie cannot span `thefibre.app` and `thethread.app`. Cross-apex links
therefore go through the hop (shipped v0.48.0, `packages/shared/src/sso-hop.ts`):

```
source app /sso/hop?to=<slug>&next=<path>
  └─ POST /api/v1/sso/handoff   (user's own Bearer JWT, JWKS-verified)
       └─ single-use 60s code in sso_handoff, bound to (user, target app)
  └─ 302 → <target>/sso/land?code=…&next=…&prefs=…
       └─ POST /api/v1/sso/redeem  (X-SSO-Secret, checks code+target+expiry,
            race-safe single-use claim)  → admin.generateLink('magiclink')
            → returns token_hash (NO email is sent)
       └─ verifyOtp(token_hash) → fresh, INDEPENDENT session on this apex
       └─ 302 → /auth/callback?next=…  (normal access-check runs)
```

Key properties: each apex holds its own session (never share one Supabase
refresh-token family across apexes — rotation kills it); the real credential
never enters a URL; the destination allowlist IS the branding registry;
theme/sidebar/locale prefs ride along; failures degrade to the target's
sign-in page. **`crossAppHref(current, target, env, next?)` is the only
correct way to link between apps** — it emits a plain URL same-apex and a
hop link cross-apex. The app switcher (`lib/available-apps.ts`,
`buildAppList({currentApp,…})`), the web dashboard cards, and the
Membership/Pulse `profileHref` all use it.

### 6.4 App keys (external apps) and the API auth gate

`apps/api/src/middleware/app-context.ts` is the front door:

- **User requests**: Bearer JWT + `X-App-ID` header (validated against the
  open `public.app` catalogue — never re-add a slug allow-list anywhere).
- **App-key requests** (`app_key` table, sha256-stored, scoped to
  app×workspace): `ctx.userId` is `''`; use `actorUserId(ctx)` for user
  FKs and filter `workspace_id` explicitly — RLS is not acting for you.
  Keys reach an explicit route allow-list (`APP_KEY_ROUTES`, default
  deny); scopes are enforced against the app's manifest. Adding a scope is
  a deploy (`lib/app-keys.ts`), not a migration — on purpose.
- `PUBLIC_PATHS` / `PUBLIC_PREFIXES`: routes with their own auth story
  (SSO secret, Stripe signatures, participant JWTs, public reads).
- An **archived-workspace gate** (v0.51.2) blocks most routes for archived
  workspaces; `/auth /billing /profile /privacy /sso` are allowlisted so
  archived users can still reach Settings → Plan (and the hop still works).

External-app onboarding is self-serve: `POST /api/v1/apps/register`
(status pending → approved at `/admin/apps`). The whole external contract
is `docs/building-on-the-fibre.md` — **read its §6 before touching anything
under `/api/v1/apps/*`** (see §7 below).

### 6.5 The Fibre as OAuth2 provider

`apps/api/src/routes/oauth-provider.ts` — minimal OAuth2 provider used for
Circle.so community SSO (WP-OAuth preset): `/oauth/authorize` → membership
app `/oauth-continue` (needs a Supabase session) → single-use 60s code →
`/oauth/token` (15-min HS256 JWT on `SSO_INTERNAL_SECRET`) → `/oauth/me`,
which only answers for ACTIVE/GRACE `membership_member` emails — a lapsed
membership IS the revocation. Client registrations are DB rows
(`oauth_client.redirect_uris`, exact-match).

---

## 7. API contracts — what must never break

1. **`/api/v1/apps/*` is additive-only.** It is a published contract that
   external apps are written against. Add fields; never rename, remove,
   retype or re-mean one (semantic changes break callers just as hard).
   `apps/api/scripts/verify-external-app.mjs` asserts every published
   shape end-to-end with a throwaway app — run it after touching this area.
2. **Thread's three public read routes** (`/api/v1/thread/public/…`) are a
   published contract with `origin: '*'` CORS (reads only, no PII).
   `apps/api/scripts/verify-public-api.mjs` guards shapes, CORS and the
   third-party rate limiting. Never widen the `*` CORS beyond the
   `PUBLISHED_READ_PATHS` set.
3. **CORS for everything else derives from the branding registry**
   (`server.ts`: `PROD_ORIGINS = APP_IDS.map(appUrl)` — deliberately
   env-less, so registry defaults ARE prod). Extra origins (staging `.tech`,
   transition windows) ride the `CORS_ORIGINS` Fly secret. **Never
   hand-write an origin list** — hand-written domain lists are this repo's
   most-repeated bug class.

---

## 8. Payments

**Stripe is rails; the `purchase` ledger is the record.** Never build a
feature on Stripe's API as the source of truth — money events land in the
platform `purchase` table (the second sanctioned data-wall crossing) via
`recordPurchase`-style writes that are update-first-insert-second on
`(app_id, item_ref)` so webhook retries and double-submits are safe.
A new payment method = a `method` value + a webhook that records purchases.

- **Connect checkout** (Thread tickets, Meet paid bookings, Membership
  joins): per-workspace Stripe accounts, plan-aware platform fee
  (`lib/fees.ts`), success/cancel URLs built from `appUrl()`/
  `THREAD_APP_URL`/`MEMBERSHIP_APP_URL` (env override → registry fallback).
- **Platform billing** (workspace subscriptions): `routes/billing.ts`,
  plans in `billing_plan` (edited at `/admin/plans`; gates always follow
  `plan_id`, **prices never gate features**; call `forgetAllPlans()` after
  any `billing_plan` write). Seats + metered overage exist (org seats,
  usage meters). Catalogue order comes from `sortPlans`
  (free→starter→pro→org, never by price).
- **Webhooks** all point at the Fly API host (domain moves don't touch
  them): `/api/v1/{meet,thread,billing,membership}/stripe-webhook`, each
  with its own secret. Signature-verified in-handler.
- **Payments SPoT**: Stripe account ids + invoice details live on
  `user_profile`/`workspace`; ALL readers go through
  `apps/api/src/lib/payment-accounts.ts` (old app-local columns are read
  fallbacks — never write them again). Same pattern for connections
  (Google refresh tokens, room URLs): `lib/connections.ts` over
  `user_connection`.
- Invoices render from the ledger (`lib/invoice-pdf.ts`, shared invoice
  UI); scheduler + webhook + payment-link flows converge on
  `finalizePaidEnrolment` / `sendTriggeredMessages` — extend those, never
  fork parallel paths.

---

## 9. Environments, domains, deploys

Full runbooks: `docs/deploy.md` (prod) and `docs/environments.md`
(staging; its gotcha list is battle-earned — read before touching env).

| | Production | Staging |
|---|---|---|
| Web/apps | thefibre.app + app./meet./flow./pulse./membership.thethread.app | thefibre.tech + meet./thread./flow./pulse./membership.thefibre.tech |
| API | `thefibre-api` (Fly, fra) → thefibre-api.fly.dev | `thefibre-api-staging` |
| DB/Auth | Supabase `zfsyyokepyycefbxiblc` | Supabase `lukhyylwhhjyihqtghvw` |
| Cookie domain | `.thefibre.app` (web) / `.thethread.app` (five apps) | `.thefibre.tech` |
| Stripe | live keys | sandbox keys |
| Deploy trigger | `git push origin main` | `git push origin main:staging` |

- **Vercel**: six projects (`thefibre`, `thefibre-{meet,thread,flow,pulse,
  membership}`), all in the `sjoerd-1708s-projects` scope. Domains are
  attached per-project in Vercel (each domain to ITS OWN project — the
  2026-09-03 misroute lesson); DNS is at **TransIP** (A records
  `76.76.21.21` for the thethread subdomains; trailing dots on external
  CNAMEs; the green "DNS Opslaan" is the actual save). Staging domains are
  Preview deployments bound to the `staging` branch.
- **Build skipping**: each app's `vercel.json` has
  `ignoreCommand: scripts/vercel-ignore.mjs <app>` — a build runs only if
  that app, `packages/shared`, or the lockfile changed. Consequence:
  **env-var-only changes rebuild nothing**; touch `packages/shared` or
  redeploy manually to pick them up.
- **Env matrix** is machine-checked: `node scripts/verify-vercel-env.mjs`
  (values may be per-project functions — e.g. the two-apex cookie domain).
- **Fly**: `fly deploy --remote-only` (prod) /
  `fly deploy -c fly.staging.toml --remote-only`. Secrets via
  `fly secrets set` (use `--stage` to defer to the next deploy). Fly
  machine leases block force-destroys for ~15 min after a half-completed
  deploy — wait it out.
- **Smoke**: `scripts/smoke-staging.mjs` asserts every subdomain serves its
  own app by `<title>`, deriving subdomains from the web apex env — reuse
  the pattern for any domain work.
- Old `*.thefibre.app` app subdomains still serve during a grace window;
  the **hard cut** (detach + drop transitional `CORS_ORIGINS`) is queued in
  `docs/build-plan.md` item 0.

---

## 10. Version management & release procedure

- **One monorepo version** stamped in **nine** `package.json` files (root,
  six apps, api, shared) **plus** `apps/web/lib/version.ts` (`VERSION`
  constant — shown in the Fibre sidebar footer and Settings → How The
  Fibre works). SemVer-ish: features bump minor, fixes bump patch.
- **Per-app user-facing versions are decoupled**: Meet shows `v2.x`
  (`apps/meet/app/(app)/layout.tsx`), Thread `v3.x`, Flow / Pulse / Membership
  their own constants in their layouts. Bump those only when app-specific
  surfaces ship.
- **Every release = one commit** containing: the code, the nine version
  bumps, `version.ts`, and a `CHANGELOG.md` entry (top of file, dated,
  narrative style — say *why*, record decisions and reversals explicitly).
  Groom `docs/build-plan.md`'s Open queue in the same ship.
- **After every ship** (standing authorization): `git push origin main` +
  `git push origin main:staging`, `bash scripts/db-push-prod.sh` +
  `db-push-staging.sh` if migrations, `fly deploy` (both APIs if
  `apps/api` or `packages/shared` changed). Vercel deploys itself from the
  push. When debugging, first verify deployed == committed.
- **Multiple concurrent LLM sessions are normal** in this repo. The
  serialization protocol (see `CLAUDE.md` and the memory notes):
  - The version files + CHANGELOG are the serialization point — **never
    two sessions in a release at once**.
  - Announce "RELEASING NOW" to the other sessions before a bump and
    "released <sha>" after; `git pull` immediately before bumping.
  - **Stage explicit paths only, never `git add -A`** — the working tree
    is shared and may hold another session's mid-flight edits. Check
    `git status` column 1 for pre-staged entries; `git diff HEAD -- <file>`
    any shared-ownership file before adding it whole; after committing,
    verify every import the commit introduces resolves within the commit.
  - Fence lanes by directory; coordinate shared files (layouts,
    `packages/shared/package.json`) explicitly.
- **Verification is part of the release**: `pnpm -r typecheck` always;
  the relevant `verify-*` script for the area touched; a **signed-in
  browser render check for any shell/chrome/layout change** (typecheck-
  clean ≠ render-correct); never destructive tests against production
  data (reads fine; writes need a fixture or a check-in first).

---

## 11. Working on this codebase

### Local dev

```bash
export PATH="$HOME/.local/bin:$PATH"
cd ~/Projects/thefibre
pnpm dev          # api :8080 + six apps :3000-:3005
```

Only some apps have local `.env.local` (web has the full set incl.
`SSO_INTERNAL_SECRET`); apps without one render public pages but can't
sign in locally — that's known, not broken. Seed realistic data:
`cd apps/api && node scripts/seed-ebbf.mjs` (idempotent; builds the brief
§8 worked example). After a burst of many file changes (e.g. parallel
agents), the Next dev server can wedge — kill and restart `pnpm dev`.

### Debugging

**Read the API server log first, hypothesise second.** `upsertProfile`,
`upsertOrgProfile` and the SSO resolver log full Postgres errors
(code/details/hint) to stderr — the constraint name is right there. Order:
browser Network tab → API stderr → then think. (This rule exists because a
"Save doesn't work" bug once burned six releases of guessing.)

### i18n

Six locales; **every user-facing string goes through a catalog** — signed-in
chrome via `lib/i18n-ui.ts`, public surfaces via `lib/i18n.ts`
(thread/membership), shared components via `chromeT`. Typed: a missing key
is a compile error. Machine-translated drafts carry `// MT`. Locale
resolution for emails: `platformEmailLocale` is THE resolver.

### Mobile

All six apps have the shared bottom tab bar + "More" sheet
(`ui/bottom-nav`); dialogs render as sheets below `sm`. Builders (Flow
canvas, timeline editor) are deliberately desktop-first.

### Common tasks → where to look

| Task | Start here |
|---|---|
| Rename an app / change a domain | `packages/shared/src/branding.ts` (+ env, Vercel domains, §9). Slugs NEVER change. |
| Add a cross-app link | `crossAppHref` from `@thefibre/shared/sso-hop` |
| Add an API route | `apps/api/src/routes/*.ts`, mount in `server.ts`; auth posture in `middleware/app-context.ts` |
| New table / column | new migration; RLS policy; ask "which app justifies this field?" |
| Money event | `purchase` ledger + `lib/fees.ts` + the relevant `*-payment-link.ts` / webhook |
| Email | `apps/api/src/lib/email/*-templates.ts`; sender/branding from `branding.ts`; locale via `platformEmailLocale` |
| New UI surface | `packages/shared/src/ui` first (§5 rule) |
| Website embed | `packages/shared/src/embed-loader.ts` + the app's `/embed.js` route + its Settings embed-code generator |
| Plans/gating | `apps/api/src/lib/plan.ts`, `/admin/plans`, `forgetAllPlans()` |
| Env/domain audit | `node scripts/verify-vercel-env.mjs` |

---

## 12. Document map

| Document | Role |
|---|---|
| `docs/fibre-technical-brief-v0.4.md` | The canonical vision + data-model spec (v0.3 kept for traceability) |
| `docs/building-on-the-fibre.md` | The app contract — everything an in-family or external app must obey |
| `docs/brief-external-apps.md` | How third-party apps integrate (app keys, scopes, links) |
| `docs/build-plan.md` | **The** Open queue (to-do), groomed every ship |
| `CHANGELOG.md` | The shipped record, narrative per release |
| `docs/deploy.md` / `docs/environments.md` | Prod / staging runbooks incl. every env var and hard-won gotcha |
| `docs/naming-brief.md` | The branding pivot: Thread flagship, function names, Fibre backstage |
| `docs/meet-architecture.md`, `docs/fibreflow-*.md`, `docs/membership-proposal.md`, `docs/fibre-pulse-proposal.md` | Per-app deep dives |
| `docs/invoices-and-roles-proposal.md`, `docs/pricing-proposal.md`, `docs/productisation-proposal.md` | Money: ledger, roles, tiers |
| `docs/i18n-proposal.md` | Locale architecture |
| `docs/spike-circle-sso.md` | The OAuth-provider spike |
| `CLAUDE.md` | LLM session working notes: hard rules, gotcha index, current state |

## 13. The hard rules (memorise these)

1. **No personal data in Vercel** — every PII operation goes through the EU API.
2. **`X-App-ID` on every API request** (user sessions).
3. **RLS on every table**; workspace + app-membership scoping.
4. **Soft delete only** for personal data; **activity is append-only**.
5. **Cursor pagination only.**
6. **`/api/v1/apps/*` and the Thread public reads are additive-only published contracts.**
7. **Never hand-write a domain/origin/app list** — derive from the branding
   registry (`APP_IDS`/`appUrl`) or the `app` catalogue.
8. **Slugs never change**; display names and domains are `branding.ts` + env.
9. **The app justifies the field** — no orphan data on the platform.
10. **Stripe is rails, the ledger is the record.**
11. **Shared components first; never fork a per-app UI variant.**
12. **Explicit-path staging; one release at a time; CHANGELOG + build-plan
    groomed in the same commit.**
