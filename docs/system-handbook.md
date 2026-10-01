# The Fibre — System Handbook

**Audience:** a programmer (very likely working with an LLM assistant) who has
never seen this codebase and needs to make a correct change to it. This is the
orientation document: architecture, structure, design rules, conventions,
version management, environments, and where everything lives. It links out to
the deeper documents rather than duplicating them.

**Facts audited against the code at v1.96.2 (2026-10-01).** The inventories
in this file (apps, domains, counts, script names) are the part that goes
stale; the architecture has aged well. Where a line here names a file that
holds the truth, trust the file. If this document and
`docs/fibre-technical-brief-v0.4.md` disagree, the brief wins on vision and
data-model intent; this handbook wins on operational facts (domains, env vars,
release procedure). A shorter, outward-facing summary for somebody evaluating
the system is [`docs/technical-overview.md`](technical-overview.md); the table
map is [`docs/data-model.md`](data-model.md).

---

## 1. What this is

A **GDPR-native relationship platform** operated by Solidarity Lab B.V.
(Rotterdam, EU-hosted). Publicly it is **The Thread**; "The Fibre" is the
backstage platform name and the name of this repository. One product family,
every member registered in `packages/shared/src/branding.ts`:

| App (catalogue slug) | Directory | Production | What it is |
|---|---|---|---|
| **The Fibre** (`fibre-platform`) | `apps/web` | thefibre.app | The platform itself: identity, contacts, organisations, programmes, activity, consent, workspaces, members, teams, billing, admin |
| **The Thread** (`the-thread`) | `apps/thread` | app.thethread.app | The flagship: learning journeys and events — public enrolment pages, tickets, payments, scheduled messages, certificates, website embeds |
| **Meet** (`fibre-meet`) | `apps/meet` | meet.thethread.app | Scheduling and booking (the rebuild of the old "Suite"): meeting types, polls, paid bookings, Google Calendar, Zoom |
| **Flow** (`fibre-flow`) | `apps/flow` | flow.thethread.app | People-flow state machine: pipelines, gates, tasks, visual builder |
| **Pulse** (`fibre-pulse`) | `apps/pulse` | pulse.thethread.app | Business planner: cashflow, commitments, budgets |
| **Members** (`membership`) | `apps/membership` | membership.thethread.app | Community subscriptions: tiers, renewals, access grants, Circle and Google Workspace integrations |
| **Connect** (`fibre-sales`) | `apps/connections` | connect.thethread.app | A community landscape: where everybody stands and who needs attention. Not a CRM |
| **Models** (`fibre-models`) | `apps/models` | models.thethread.app | Business model generators per team; a beta app |
| My Thread (surface, no slug) | `apps/my` | my.thethread.app | The participant's own page across every app: tickets, memberships, invoices, calendar |
| Website (surface, no slug) | `apps/website` | thethread.app | The marketing site |
| `fibre-learn` | none | — | A registered slug with nothing built (`available: false`) |

A slug never changes; a display name is branding and may (the slug
`membership` shows as "Members", `fibre-sales` as "Connect"). The two
surfaces without a slug send `X-App-ID: fibre-platform`.

**Two apex domains, deliberately** (since v0.52.0, the "branding pivot"): the
platform lives on `thefibre.app`; every other app lives on a subdomain of
`thethread.app` (Thread takes `app.`), and the apex is the marketing site.
Sessions cross the two apexes via the SSO hop (§6.3). Staging mirrors all of
it on `thefibre.tech` (Thread is `thread.`, not `app.`). Naming rationale:
`docs/naming-brief.md`.

---

## 2. Architecture in one paragraph

A single **Hono API** (`apps/api`, port 8080, deployed on Fly.io) fronts a
**Supabase** Postgres+Auth project (EU/Ireland). Ten **Next.js 15** apps
(App Router, React 19) call the API for everything — **no app ever talks to
Supabase data directly; only Supabase *Auth*** (sign-in, session cookies).
Users sign in via Google OAuth or an emailed code through Supabase Auth (the
participant portal offers the code only); the API verifies the resulting JWT
statelessly (JWKS) and a custom access-token hook stamps workspace and
membership claims into it. The frontends are stateless (Vercel, `fra1`) and
hold **no personal data** — every PII operation crosses into the EU API.

**Who enforces tenancy — read this before trusting "RLS does it".** RLS is
on every table and is the floor: an anonymous or foreign session reads
nothing, and `rls-floor.int.test.ts` proves that for every table on each run.
But most API routes do their work with the **service-role client**
(`adminClient`), which RLS never sees: 48 of 57 route modules import it,
against 24 that use the user-scoped client. On those paths the tenancy
boundary is the route's own `workspace_id` filter, written by hand. Two real
holes of exactly this shape were found and closed in September 2026 (Thread's
service-role writes, the person-merge route), each now pinned by an
integration test that attacks from a second workspace
(`thread-tenancy.int.test.ts`, `persons-merge-tenancy.int.test.ts`). The rule
for new code: use `userClient(ctx.jwt)` when the caller's own rights are the
question; when you must use `adminClient`, filter `workspace_id` explicitly
and write the cross-workspace test.

The API also accepts three credentials that are not a user session: **app
keys** for external apps (§6.4), **MCP grant tokens** for a person's own AI
assistant (§6.5), and **Circle sign-in tokens** (§6.5).

There is **no queue and no worker**. Background work is seven in-process
ticks in `apps/api/src/server.ts` every five minutes (scheduled Thread
messages, membership renewals and access syncs, usage meters, the Connect
hygiene sweep, fee statements, filing finished to-dos, the weekly VAT probe),
each under a database lease so two processes never run the same job
(`lib/scheduler-lease.ts`). `scheduler-wiring.test.ts` reads `server.ts` and
refuses a tick fired outside the lease: the VAT probe was, until v1.97.3.

### The data wall (brief §2)

The platform owns: identity (person/organisation), the contact graph,
activity events, enrolment state, consent. Each app owns its own content in
its own **table prefix** (`thread_*`, `meet_*`, `flow_*`, `pulse_*`,
`membership_*`, `connections_*`, `models_*` — every table is in the `public`
schema; there are no per-app schemas) **plus** the curator-data fields it
justifies on shared person/org tables (rows tagged `app_id`; RLS shows them
only to members of that app). Apps WRITE across the wall in exactly **two
sanctioned places**:

1. `activity` — append-only event log (type + subject, never content).
2. `purchase` — the money ledger (§8).

Three surfaces READ across it on purpose, because their whole job is the
cross-app view of one person: Connect's landscape and attention queue
(enrolments, memberships, commitments, flow runs), the participant portal
(`routes/portal.ts`) and the personal to-do list (`routes/my-tasks.ts`). They
read state, never another app's content body.

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
                    Supabase Postgres, one of two ways:
                      userClient(jwt)  → the caller's own rights; RLS applies
                      adminClient      → service role; RLS does NOT apply, so
                                         the route filters workspace_id itself
```

---

## 3. Repository structure

pnpm monorepo (`pnpm-workspace.yaml`), TypeScript everywhere.

```
apps/
  api/            Hono API (the only thing that touches data)
    src/routes/   one module per resource domain (57 modules, ~510 endpoints)
    src/lib/      cross-route logic: payments, email, plans, fees, google,
                  zoom, mcp, assistant, scheduler lease, rows() …
    src/middleware/app-context.ts   auth + tenancy + app-key gate (§6.4)
    src/integration/   tests against the real staging database (§11)
    scripts/      verify-*.mjs (contracts), audit-*.mjs, seeds, sync-stripe-plans
    Dockerfile    the Fly image; copies each workspace package BY NAME
  web/            The Fibre (fibre-platform)     :3000
  meet/           Meet                           :3001
  thread/         The Thread                     :3002
  flow/           Flow                           :3003
  pulse/          Pulse                          :3004
  membership/     Members                        :3005
  website/        Marketing site (thethread.app) :3006
  my/             My Thread (my.thethread.app)   :3007
  connections/    Connect (slug fibre-sales)     :3008
  models/         Models (beta)                  :3009   docs/business-models.md
packages/
  shared/         @thefibre/shared — THE shared package (§5)
  mcp/            @thefibre/mcp — the app-key contract as MCP tools (docs/mcp.md)
supabase/
  migrations/     235 SQL migrations, 141 tables — the schema's single source
                  of truth (docs/data-model.md is the map)
e2e/              Playwright specs against staging (pnpm test:e2e)
docs/             briefs, proposals, runbooks (§13 doc map)
scripts/          release machinery: runway.sh, release.sh, release-guard.sh,
                  next-version.mjs, promote.sh, deploy-api.sh,
                  db-push-{prod,staging}.sh, new-migration.sh,
                  check-*.mjs (migration versions, version residue, service
                  worker, app versions), smoke-{prod,staging}.mjs,
                  verify-vercel-env.mjs, verify-sso-hop.mjs, vercel-ignore.mjs
fly.toml, fly.staging.toml     the API's two Fly apps
.github/workflows/             ci.yml, nightly-contracts.yml
CLAUDE.md         working notes for LLM sessions (rules, gotchas)
CHANGELOG.md      the shipped record — every release has an entry
docs/build-plan.md  the Open queue — THE to-do list, groomed on every ship
```

The eight signed-in apps share one internal shape: `app/` (App Router;
`(app)/` = signed-in chrome with sidebar/topbar, everything else public),
`components/shell/` (thin shims over shared chrome), `lib/`
(`api.ts` = a binding of `@thefibre/shared/api-fetch`,
`supabase/{client,server}.ts`, `prefs*.ts`, `locale.ts`, `i18n-ui.ts`).
`apps/my` and `apps/website` are shaped differently (no `(app)/` group, no
shell). **Some per-app files are byte-identical copies** — the two Supabase
clients, `middleware.ts`, `tailwind.config.ts`, a handful of shell shims:
34 groups, about 3,800 redundant lines when measured on 2026-10-01
(`md5 -r apps/*/lib/supabase/server.ts`). Change one, change them all, or
better, move it into shared; `docs/build-plan.md` carries the deduplication
as an open item.

---

## 4. Database & RLS

The table-by-table map, with owners, purposes and the eight relationships a
newcomer must know, is [`docs/data-model.md`](data-model.md).

- **Migrations only.** Schema lives in `supabase/migrations/*.sql`,
  timestamped `YYYYMMDDHHMMSS_name.sql`. Supabase tracks applied migrations
  **by the fourteen digits** — editing an applied file is a silent no-op on
  remote (write a new migration instead), and two files on one version means
  the second is silently never applied. So: **create one with
  `./scripts/new-migration.sh <name>`**, never by typing a timestamp;
  `scripts/check-migration-versions.mjs` refuses a duplicate in `pnpm verify`.
- Apply with `bash scripts/db-push-staging.sh` (at release; it relinks
  production afterwards) and `bash scripts/db-push-prod.sh` (at promotion,
  BEFORE the code that needs the change). Nothing applies migrations
  automatically.
- **RLS on every table.** Workspace-scoping mandatory; app-membership
  scoping where curator data is involved. The helpers policies are built
  from: `current_user_id()`, `current_workspace_id()`,
  `current_workspace_role()`, `is_workspace_admin()`, `is_super_admin()`,
  `is_platform_admin()`, `has_app_membership()`, `has_app_role()`,
  `has_active_consent()`, `can_see_person()`, `can_see_organisation()`,
  `can_see_activity()`, plus Pulse's and Meet's own. `is_super_admin()` reads
  `public."user"`, whose own policy touches only JWT claims; keep it
  non-recursive. Two catalogue tables (`app`, `billing_plan`) rely on
  Supabase enabling RLS by default rather than on a migration statement — see
  `docs/data-model.md`.
- **Service-role-only tables** (credentials and machine state): RLS enabled
  with **no policies**, all access through the API's `adminClient` with
  explicit filters. Fifteen today: `app_key`, `oauth_client`, `oauth_code`,
  `sso_handoff`, `user_connection`, `user_active_workspace`, `mcp_grant`,
  `workspace_assistant`, `person_calendar_feed`, `scheduler_lease`,
  `platform_setting`, `public_root_slug`, `membership_settings`,
  `membership_reminder_send`, `hygiene_run`. "RLS on, no policy" is the
  intended shape for these, not a missing policy.
- **SECURITY DEFINER functions are born closed.** Default privileges revoke
  execute from `public` and `anon` (`20260914171000`); a function that should
  be callable is granted explicitly. `definer-functions.int.test.ts` probes
  every one as anon and as a signed-in user against a reviewed allowlist
  (§11.3b).
- **Soft delete only** for personal data (`deleted_at`). Activity is
  append-only; corrections are new rows.
- **Cursor pagination only.** Never offset.
- Table namespaces: platform (`person`, `organisation`, `workspace`,
  `user`, `activity`, `enrolment`, `consent_record`, `billing_plan`,
  `purchase`, `signup_request`, …) and per-app prefixes (`thread_*`,
  `meet_*`, `flow_*`, `pulse_*`, `membership_*`, `connections_*`,
  `models_*`). In-family apps use
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

`packages/shared` compiles to `dist/` (plain `tsc`); what apps may import is
the `exports` map in its `package.json` (83 entries: the root `.` plus one
per subpath). Apps depend on the BUILD, not the source —
`pnpm --filter @thefibre/web... build` (the trailing `...` builds
dependencies first; never hand-chain builds), and after pulling a commit that
adds anything to shared's public surface, `pnpm --filter @thefibre/shared
build` before believing a typecheck error in some other app.

The load-bearing modules:

| Module | What it is |
|---|---|
| `branding.ts` | **THE domain/name registry.** `APPS[slug]` = name, tagline, `url` (prod default), `urlEnv` (env override key), `available`; `SURFACES` for the portal and the website. `appUrl(slug, env, host)` is the only correct way to build an app URL — the `host` argument keeps a page served from staging pointing at staging siblings. Also `stagingAppUrl`, `surfaceUrl`, `mcpConnectorUrl`, `appHomePath`, `APP_DISPLAY_ORDER`, `ENTITY` (legal entity; public name "The Thread"), `FOOTER_LINKS`, `BRAND_ASSETS`, `EMAIL_BRAND`. A rename or domain move is this file + env. |
| `app-shell.ts` | `loadAppShell()` — every signed-in layout's one parallel load: who you are, which apps the workspace runs, which workspaces you may switch to. |
| `api-fetch.ts` | `createApiFetch()` — each app's `lib/api.ts` is a binding of it; `ApiError`. |
| `available-apps.ts` | `buildAppList()` — the app switcher's list, from the catalogue and the caller's seats. |
| `sso-hop.ts` | Cross-apex SSO (§6.3): `crossAppHref()`, `createSsoHop/Land()`. |
| `auth-callback.ts` | `createAuthCallback()` — the shared OAuth/OTP callback flow (eight apps wire it; **web still has its own richer copy** with signup-status branches — fold before touching callbacks). |
| `security-headers.ts`, `root-layout.tsx`, `robots.ts` | One definition each of the response headers, the root metadata/icons and the crawler policy, used by every app's `next.config.mjs` and `app/`. |
| `design/tokens.ts`, `ui/recipes.ts` | The colour role tokens and the recurring looks; `design/tokens.test.ts` fails a release that types a colour in an app (`docs/brand-design.md`, binding). |
| `embed-loader.ts` | `buildEmbedLoader()` — origin-relative website-embed loader; Thread + Membership serve it at `/embed.js`. Iframe origin derives from the pasted `<script src>`; postMessage is origin-checked. Embeds are deliberately iframes (`docs/…` decision, don't propose web components again). |
| `prefs.ts` | Cross-app preference cookie names/types. |
| `i18n.ts`, `locale-resolution.ts`, `ui/i18n-ui.tsx`, `ui/chrome-server-i18n.ts` | Six locales (en, nl, es, pt, de, fr), **typed catalogs** — a missing translation is a type error. `// MT` marks machine drafts (es, pt, de and fr are almost entirely machine-drafted and unreviewed). |
| `ui/*` | The shared component library: app-switcher, topbar, sidebar-shell, user-menu, bottom-nav (mobile tab bar), dialog, button, fields, DateField/DateTimeField, settings, invoices, payment-methods, profile-form, help, todo-panel, assistant, toast, … |

**Components-first rule (binding):** before building ANY UI surface, check
`packages/shared/src/ui` and the other apps. Use or extract the shared
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
(8-digit code). Those are the only two methods built: the API's
`/sso/resolve` accepts `microsoft` and `linkedin` as provider names, but no
frontend offers them. The participant portal (`apps/my`) offers the emailed
code only. Each app's `sign-in-button.tsx` (`sign-in.tsx` in `apps/my`) builds
`redirectTo = ${window.location.origin}/auth/callback` — origin-relative,
nothing hardcoded. The callback (shared factory, §5) exchanges the PKCE
code, then calls the API's `/api/v1/sso/access-check` and `/sso/resolve`
(server-to-server, `X-SSO-Secret` header = `SSO_INTERNAL_SECRET`) to map
the auth identity to a platform user/workspace, then `refreshSession()` so
the access-token hook stamps claims. Participants (the My Thread portal,
Thread `/my`, the Membership portal) are ordinary Supabase users with **no
workspace membership** — the callback's `publicPrefixes` option skips the
access gate for those paths (thread `['/my']`, membership
`['/my', '/oauth-continue']`, my `['/']`). Accounts auto-create at enrolment
(email-only; verified at first sign-in).

**One human, several workspaces.** There is no foreign key from
`public.user` to `auth.users`: a person in N workspaces has N `user` rows
tied together by email, and the access-token hook picks which one a session
acts as — the row named in `user_active_workspace` if there is one, else the
oldest. Switching workspace is `POST /api/v1/auth/workspace` followed by a
token refresh. The JWT's `sub` is `auth.users.id`; anything that references
`user(id)` must use the `app_user_id` claim.

External registrations: Google Cloud Console holds ONE redirect URI (the
`…supabase.co/auth/v1/callback`) — app domains appear only as authorized
JS origins + consent-screen domains. The Supabase dashboard's Redirect URLs
allowlist must contain each apex wildcard (`https://thefibre.app/**`,
`https://*.thefibre.app/**`, `https://*.thethread.app/**`).

### 6.2 Session sharing within an apex

`@supabase/ssr` cookies, chunked `sb-<ref>-auth-token`, with
`Domain = NEXT_PUBLIC_COOKIE_DOMAIN`. Production: `.thefibre.app` on the
platform project only, `.thethread.app` on every other project; staging
`.thefibre.tech`; local unset. Within an apex, sign-in on one app IS
sign-in on all (silent SSO — the cookie just travels). The same env var
scopes the **preference cookies** (`thefibre.theme`, `thefibre.sidebar`,
`thefibre.locale`, and a few per-feature ones in `packages/shared/src/prefs.ts`;
only the first three ride the SSO hop) written by the `savePref` server action
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
sign-in page. **`crossAppHref(current, target, env, next?, host?)` is the only
correct way to link between apps** — it emits a plain URL same-apex and a
hop link cross-apex, and the serving `host` keeps a hop that starts on
staging from landing on production. The app switcher
(`@thefibre/shared/available-apps`, `buildAppList({currentApp,…})`), the web
dashboard cards, and the Membership/Pulse/Connect `profileHref` all use it.
Eight apps carry the `/sso/hop` and `/sso/land` routes; `scripts/verify-sso-hop.mjs`
checks each app's shared secret against the API, on either stack.

### 6.4 App keys (external apps) and the API auth gate

`apps/api/src/middleware/app-context.ts` is the front door:

- **User requests**: Bearer JWT + `X-App-ID` header (validated against the
  open `public.app` catalogue — never re-add a slug allow-list anywhere).
- **App-key requests** (`app_key` table, sha256-stored, scoped to
  app×workspace): `ctx.userId` is `''`; use `actorUserId(ctx)` for user
  FKs and filter `workspace_id` explicitly — RLS is not acting for you.
  Tokens start `fibre_ak_`. Keys reach an explicit route allow-list
  (`APP_KEY_ROUTES`, 37 method-and-path entries, default deny): the
  `/apps/:slug/*` family including Thread (`routes/app-thread.ts`) and Flow
  (`routes/app-flow.ts`) routes, `/apps/whoami`, and `/activities`. Scopes
  (`lib/app-keys.ts`: read/write persons, organisations, activities,
  programs; `write:curator_data`; `write:messages`; `read:flows`;
  `write:flow_runs`; `read:enrolments`; `review:enrolments`) are enforced
  against the app's manifest. Adding a scope is a deploy, not a migration —
  on purpose.
- `PUBLIC_PATHS` / `PUBLIC_PREFIXES`: routes with their own auth story —
  the SSO secret, Stripe and Zoom signatures, the Supabase email hook's HMAC,
  participant JWTs (`/me/`, `/membership/portal/`), the OAuth provider
  (`/oauth/`), the MCP endpoint, OAuth callbacks carrying signed state, and
  the public reads. A path listed there is NOT unauthenticated; it
  authenticates in its own handler.
- An **archived-workspace gate** (v0.51.2) blocks most routes for archived
  workspaces; `/auth /billing /profile /privacy /sso` are allowlisted so
  archived users can still reach Settings → Plan (and the hop still works).

External-app onboarding is self-serve: `POST /api/v1/apps/register`
(status pending → approved at `/admin/apps`). The whole external contract
is `docs/building-on-the-fibre.md` — **read its §6 before touching anything
under `/api/v1/apps/*`** (see §7 below).

### 6.5 The Fibre as OAuth2 provider — Circle, and a person's own assistant

`apps/api/src/routes/oauth-provider.ts` serves two kinds of client.

**Circle (community sign-in).** A minimal provider in the WP-OAuth shape:
`/oauth/authorize` → membership app `/oauth-continue` (needs a Supabase
session) → single-use 60s code → `/oauth/token` (15-min HS256 JWT on
`SSO_INTERNAL_SECRET`) → `/oauth/me`, which only answers for ACTIVE/GRACE
`membership_member` emails — a lapsed membership IS the revocation. Client
registrations are DB rows (`oauth_client.redirect_uris`, exact-match).

**MCP (a person's own AI assistant acting as them).** A person connects
Claude or another MCP client to their account: dynamic registration of
public clients (`POST /oauth/register`, per-IP limited), PKCE, consent in the
platform app (`apps/web/app/(app)/connect`), a one-hour access token carrying
a grant id, refresh tokens with a 90-day idle limit, and `/oauth/revoke`.
Grants live in `mcp_grant` (service-role only; the session is stored
encrypted) and are managed at Settings → Connections through
`/api/v1/mcp-auth/*`. The endpoint itself is `/api/v1/mcp` and the root of
any `mcp.*` host (`routes/mcp.ts`), with discovery under `/.well-known/`.
Since v1.97.0 the address may also carry a workspace:
`https://mcp.thefibre.app/<workspace-slug>` pins that grant's session to the
named workspace (the access-token hook honours it), so one person can connect
the same assistant to several workspaces.
Scopes: `connections:read`, `thread:read`, `thread:write`, `models:read`,
`models:write`; 120 calls a minute per grant. The tools are the same code as
the app-key contract (`packages/mcp`), so the two cannot drift.
`apps/api/scripts/verify-mcp-personal.mjs` walks the whole sign-in and a
first tool call. Deep dives: `docs/mcp.md`,
`docs/mcp-personal-access-plan.md`, and for end users
`docs/using-your-own-assistant.md`.

### 6.6 Integrations that hold somebody's credential

All per-person credentials live in `user_connection` (service-role only) and
are read through `apps/api/src/lib/connections.ts`:

- **Google Calendar** — per-user OAuth (`calendar.events`,
  `calendar.readonly`), used by Meet for availability and by Connect's
  agenda. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_STATE_SECRET`.
- **Zoom** — per-user OAuth; Meet and Thread create, move and delete real
  meetings (`lib/zoom/`, `lib/meeting-links.ts`). As of 2026-10-01 the
  Marketplace app is in development mode: working end to end on staging,
  switched off in production (no credentials there), and its
  deauthorisation webhook is built and tested but has never been called by
  Zoom. `docs/zoom-marketplace-submission.md` is the review packet.
- **Google Workspace admin** and **Circle** are per-WORKSPACE credentials in
  `membership_settings`, used by the membership scheduler to grant and
  withdraw access.
- **The in-app assistant** (`routes/assistant.ts`, `lib/assistant/`) calls
  Anthropic with either the platform key (`ANTHROPIC_API_KEY`) or a
  workspace's own key (`workspace_assistant`, encrypted). Without a key it
  answers 503 and the panel stays hidden. `docs/assistant-in-app.md`.

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
   third-party rate limiting. There are exactly two deliberate `origin: '*'`
   sets in `server.ts`: these `PUBLISHED_READ_PATHS`, and the OAuth/MCP
   endpoints a third-party client must reach (`/.well-known/*`,
   `/oauth/register`, `/oauth/token`, `/oauth/revoke`, `/api/v1/mcp`).
   Never add a third without the same argument written beside it.
3. **CORS for everything else derives from the branding registry**
   (`apps/api/src/lib/cors-origins.ts`: production origins from `APPS` and
   `SURFACES` — deliberately env-less, so registry defaults ARE prod; staging
   origins, apps and surfaces both, are derived the same way and apply only
   on the staging Fly app). Extra origins for a transition window ride the
   `CORS_ORIGINS` Fly secret. **Never hand-write an origin list** —
   hand-written domain lists are this repo's most-repeated bug class, and
   since v1.97.3 `cors-origins.test.ts` holds both lists against what they
   follow: the allowed methods against every verb a route registers, the dev
   ports against every `apps/*/package.json`.
4. **`/auth/me` is a published shape too, in practice.** Eight apps read it,
   so a local need answered there is a wide contract widened for one screen.
   Answer a situational question — may this user edit, does this workspace
   have X — on the endpoint that already owns it and that the screen is
   already calling. Connections' band-label endpoint returns `can_edit` for
   exactly this reason; Thread's dashboard takes a name and an email from
   `/me` and nothing else.
5. **Two more contracts have a runnable check**: the personal MCP sign-in
   and tool flow (`verify-mcp-personal.mjs`) and the Stripe webhook
   configuration (`verify-stripe-webhooks.mjs`). Of all of these, only
   `verify-public-api.mjs` runs inside `pnpm verify`; the others are run
   after touching their area and in each stress round.

### Attach a person by an EXACT identifier, never by a name in prose

The line is drawn by whether the identifier is exact, **not** by how useful
the feature would be. Three sightings, none of which knew about the others
when they were written:

- **Thread** resolves an enrolment by email and a door check-in by
  `checkin_code`. Both refuse rather than guess.
- **Connections** matches calendar attendees to people by email — exact, so
  there is no fuzzy match to get wrong.
- **Connections** deliberately does NOT match person names inside note text,
  even though that is obviously the more powerful feature, because a bare
  first name is not an identifier. `apps/connections/lib/detect-tags.ts`
  matches only the workspace's own vocabulary and organisation names for
  exactly this reason.

The asymmetry is the point: the SAME product goal — connect things without
the user doing it — gets a hard yes on an email address and a hard no on a
name in a sentence. A false positive here does not produce a wrong row, it
attaches a claim to a real person's record, and no amount of usefulness pays
for that.

If a future feature needs to infer a person from free text, the answer is
that the feature should change, not the rule.

**And the same rule one level up: co-occurrence is not a relationship.** The
version above is about the INPUT — an email address is exact, a first name in
prose is not. This one is about the INFERENCE. Two people appearing in the
same note have co-occurred. Two people enrolled in the same thread have
co-attended. Neither is a connection, and both are one small step from being
recorded as one, because the step is cheap and the result looks like insight.

The cost is the same shape as a wrong match: an edge that meant "somebody
states these two know each other" starts meaning "these two were typed near
each other", and every surface reading it inherits the dilution silently.
Connections keeps `flow_run_note_mention` deliberately out of `relationship`
for exactly this reason — the contribution axis reads `relationship` for
introductions, and promoting mentions would inflate a number that is supposed
to mean something.

So: **a relationship edge is something a person STATES.**

And the test that keeps the rest of it from being a placeholder: **a signal
inferred from co-occurrence or similarity may be shown, but must never be the
input to another computation.** Position a cloud with it, size a word with it,
sort a list by it. The moment it feeds a second derivation its provenance is
gone and it has become a fact — which is the mechanism by which weak signals
turn into edges without anybody deciding to promote one. Checkable by reading
the code rather than by judgement, which is the whole point of having it.

**This does not forbid composing derivations, and the distinction matters or
the rule reads as banning what this codebase does everywhere.**
`connections_landscape_axis` delegates maturity to `connections_landscape`;
`connections_attention` delegates `deal_rotting` to `pulse_commitment_rot`.
Both are fine and both should stay. They compute over RECORDED FACTS —
somebody attended, somebody paid, a stage moved on a date — and composing
those is factoring, not inference.

**The exemption is a property of the INPUTS, not of the function, and it is
transitive.** A computation is fact-derived only if every input is, all the
way down. One proximity or similarity signal entering anywhere upstream makes
everything below it proximity-derived, and the ban applies to all of it. It
behaves like a taint rather than a category, which is what keeps it checkable:
follow the inputs through the definitions, no judgement about whether
something "counts".

That clause is the one that has to survive contact with a future change, and
the pressure will not look like an attack. Nobody will propose composing two
inferences. Somebody will propose nudging maturity when two people co-occur
in notes — one weak signal added to something already trusted, an obvious
improvement. Maturity is then part proximity, every axis and queue below it
inherits that, and all of them are still described by the sentence that
exempted them. Nobody lies. The label just stops tracking the thing.

The test also protects the door it might look like it closes: the desktop
cloud can use co-occurrence for position and weight, which is exactly what it
needs, and still cannot say "these two know each other", because saying that
would mean something else reading the signal.

(Named jointly on 2026-09-12. The input half came from Connections, the
inference half and this test from the Thread session — which also identified
thread co-attendance as the same trap waiting in a different table, and
caught the first draft of this paragraph saying derived closeness may use
co-occurrence "if it earns it": a phrase with no test attached, which would
have been quoted as permission. That draft was written in the same hour as
the three corrections above, by the session writing the rule about them.)

### Do not write "X is not personal data" when you mean "the reader already has it"

Connections ships the workspace's organisation names to the browser as a
detection dictionary. The easy justification — *organisation names are
companies, not people* — is **false**, and was caught in review: a sole
trader is a person with a business name, and "Jan de Vries Coaching"
identifies a natural person as directly as their own name. Nothing in an
`organisation` row distinguishes the two cases and nothing ever will.

The defensible reason is the RECIPIENT: the payload goes to a signed-in
workspace member who can already read every one of those rows through the
ordinary interface, so it discloses nothing new. That reasoning holds for the
sole trader too, which is what makes it the right test.

This is the same failure shape as the `Accept-Language` sentence below — a
claim that happens to be true of today's data, written as though it were true
by nature. Those sentences get cited later by somebody shipping the same
thing somewhere less careful, which is why the wording matters more than the
decision did.

### Three conventions that were arrived at twice

Each of these was reached independently in Connections and in Thread on
2026-09-12, by sessions that had not compared notes. Recorded with both
instances, because a convention with two independent sightings is a property
of this codebase, while one is somebody's taste.

**Typed text carries no locale.** The six-locale typed catalogs are for
CHROME. A sentence a person typed is content, and this codebase does not
translate content — `connections_band_label` has one `label` column,
`thread_settings`'s `site_name` / `site_headline` / `site_intro` are plain
text. A workspace's own words are shown as they were written.

Note what this does NOT rest on. It is not that we lack the visitor's
language: every browser sends `Accept-Language` and a signed-in participant
has `person.preferred_language`, which the enrolments select already reads.
Nothing in the repo reads `Accept-Language` today — that is a choice, not an
absence, and defending the rule as an absence loses the argument the first
time somebody says "just read the header", which would be correct. The rule
is simply that translating a workspace's own words is not something this
product does, and it keeps holding on the day somebody does read that header
for the chrome.

**An empty value means absent, never "store today's default".** An emptied
field deletes the row or writes null, because absence is what the fallback
reads. An override holding the current default is a default that has quietly
stopped being one — it will not follow the default when the default changes,
and in a translated product it freezes that string in whatever language it
was captured in. Connections' rename clears the row; Thread's website form
maps an emptied field to null.

**Name it, don't redefine it.** A workspace names things; the system decides
what they DO. Thread lets a workspace name its categories and keeps what a
category does; Connections lets a workspace name its lifecycle steps and
keeps what earns one derived. The argument is the same in both: a rule a
workspace can rewrite is a rule a workspace has to maintain, and a
hand-maintained rule is wrong within a month. When a configuration request
arrives, the useful question is which half is being asked for.

---

## 8. Payments

**Stripe is rails; the `purchase` ledger is the record.** Never build a
feature on Stripe's API as the source of truth — money events land in the
platform `purchase` table (the second sanctioned data-wall crossing) via
`recordPurchase`-style writes that are update-first-insert-second on
`(app_id, item_ref)` so webhook retries and double-submits are safe.
A new payment method = a `method` value + a webhook that records purchases.

- **Connect checkout** (Thread tickets, Meet paid bookings, Membership
  joins). The money goes to a connected Stripe account, and WHICH account is
  resolved per item, not per workspace (`lib/payment-accounts.ts`):
  - Thread: the organiser's personal account, or the workspace account, or
    the team lead's (`threadDestinationAccount`; `payment_destination` on the
    thread, the team's `payout_destination`).
  - Meet: the host's personal account.
  - Membership: always the workspace account.

  Success/cancel URLs come from `appUrl()` with `THREAD_APP_URL` /
  `MEMBERSHIP_APP_URL` / `MEET_APP_URL` as env overrides.
- **The platform fee** is plan-aware (`lib/fees.ts`): the columns are
  `billing_plan.meet_paid_pct` / `meet_paid_cap_cents`, read through the RPC
  `workspace_meet_fee`. The name says "meet"; every app uses it. Fallback 2%
  capped at €2; zero when the destination is the platform's own account.
  Each month `lib/fee-statements.ts` issues one VAT statement per workspace
  for the fees taken (a `fibre-platform` ledger row, born `paid`), from the
  scheduler under a lease and on demand via
  `POST /api/v1/admin/fee-statements/run`.
- **Connecting a Stripe account** is Standard OAuth (`lib/stripe/connect.ts`,
  since 2026-09-24): `GET /workspace-billing/stripe/connect`, `/stripe/callback`,
  `/stripe/status`, `POST /stripe/test-payment`, and the `/profile/stripe/*`
  twins for a person. **It is dark until `STRIPE_CONNECT_CLIENT_ID` is set**
  (`connect_available` is false and the UI falls back to a paste field, which
  grants no permission). State is HMAC-signed with `SSO_INTERNAL_SECRET`.
- **Platform billing** (workspace subscriptions): `routes/billing.ts`
  (`/usage`, `/checkout`, `/switch`, `/cancel`, `/resume`, `/reactivate`,
  `/portal`, `/stripe-webhook`), plans in `billing_plan` (edited at
  `/admin/plans`; gates always follow `plan_id`, **prices never gate
  features**; call `forgetAllPlans()` after any `billing_plan` write). Seats
  and metered overage exist (org seats, usage meters). Catalogue order comes
  from `sortPlans` (`free → starter → pro → org → beta`, never by price).
- **Webhooks** all point at the Fly API host (domain moves don't touch
  them): `/api/v1/{meet,thread,membership,billing}/stripe-webhook`,
  signature-verified in-handler. Three are **Connect-mode** endpoints (meet,
  thread, membership — events on connected accounts); billing is
  platform-mode. Secrets: `STRIPE_WEBHOOK_SECRET` (Meet, and Thread's
  fallback), `STRIPE_THREAD_WEBHOOK_SECRET`,
  `STRIPE_MEMBERSHIP_WEBHOOK_SECRET`, `STRIPE_BILLING_WEBHOOK_SECRET`. The
  expected endpoints and events are DATA in
  `apps/api/scripts/lib/stripe-webhooks.mjs`; `verify-stripe-webhooks.mjs`
  audits a Stripe account against it and `register-stripe-webhooks.mjs`
  repairs it.
- **Payments SPoT**: ALL readers go through
  `apps/api/src/lib/payment-accounts.ts`. A person's account resolves
  `identity_billing` (keyed by email) → `user_profile` → `thread_organiser`
  → `meet_host`; a workspace's resolves `workspace` → `thread_settings`. The
  app-local columns at the end of each chain are read fallbacks — never write
  them again (one exception: `PATCH /workspace-billing` still clears
  `thread_settings.stripe_account_id` so a disconnect sticks). Same pattern
  for connections (Google refresh tokens, Zoom tokens, room URLs):
  `lib/connections.ts` over `user_connection`.
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
| Platform (The Fibre) | thefibre.app | thefibre.tech |
| Apps | app. (Thread) / meet. / flow. / pulse. / membership. / connect. / models. / my. on thethread.app | thread. / meet. / flow. / pulse. / membership. / connect. / models. / my. on thefibre.tech |
| Marketing site | thethread.app (apex) | none — the website has no staging deployment |
| MCP connector | mcp.thefibre.app | mcp.thefibre.tech |
| API | `thefibre-api` (Fly, fra) → thefibre-api.fly.dev. The address the outside world is told to dial is `PUBLIC_API_URL` (`lib/public-url.ts`, default the fly.dev host); `api.thethread.app` is being introduced for it — read `fly secrets list -a thefibre-api`, not this line | `thefibre-api-staging` → thefibre-api-staging.fly.dev |
| DB/Auth | Supabase `zfsyyokepyycefbxiblc` | Supabase `lukhyylwhhjyihqtghvw` |
| Cookie domain | `.thefibre.app` (the platform) / `.thethread.app` (every other app) | `.thefibre.tech` |
| Stripe | live keys | sandbox keys |
| How code arrives | `./scripts/promote.sh` fast-forwards `main` to a staging commit; Vercel builds from `main` | `./scripts/release.sh` pushes to `staging`; Vercel builds Preview deployments bound to that branch |
| How the API arrives | `./scripts/deploy-api.sh prod` (a separate step, after promote) | `./scripts/deploy-api.sh staging` (a separate step, after release) |

The hosts are DATA in `packages/shared/src/branding.ts` (`appUrl`,
`stagingAppUrl`, `SURFACES`); read that file rather than this table when the
two disagree. Every landing and departure needs a runway clearance — §10.

- **Vercel**: ten projects, `thefibre`, `thefibre-website` and
  `thefibre-{meet,thread,flow,pulse,membership,my,connections,models}` (the
  list `scripts/verify-vercel-env.mjs` holds). Domains are
  attached per-project in Vercel (each domain to ITS OWN project — the
  2026-09-03 misroute lesson); DNS is at **TransIP** (A records
  `76.76.21.21` for the thethread subdomains; trailing dots on external
  CNAMEs; the green "DNS Opslaan" is the actual save). Staging domains are
  Preview deployments bound to the `staging` branch.
- **Build skipping**: each app's `vercel.json` has
  `ignoreCommand: scripts/vercel-ignore.mjs <app>` — a build runs only if
  that app, `packages/shared`, or the lockfile changed. It saved ~€150 in
  five days and it has two sharp edges:
  - **Env-var-only changes rebuild nothing.** `NEXT_PUBLIC_*` values are
    inlined at BUILD time, so setting them changes nothing until a build
    runs. **"Redeploy manually" does not work** — the ignore step runs on
    dashboard and API-created deployments too, and cancels them the same
    way (measured 2026-09-09 on `thefibre-my`). Two fixes: a commit that
    touches the app's folder, `packages/shared` or the lockfile; or, since
    2026-09-15, setting `FIBRE_FORCE_BUILD=1` on the project for one build
    (`scripts/vercel-ignore.mjs`). The app's own `package.json` and
    `apps/web/lib/version.ts` are deliberately NOT trigger paths, or every
    version bump would rebuild every app.
  - **A brand-new app's Vercel project can sit for a day without deploying.**
    Wire the project, env and domains perfectly and every push still skips
    until one touches a trigger path. `thefibre-my` served a 500 for a day
    this way, from a deployment that predated its own env vars, while eight
    pushes reported CANCELED. **Last step of standing up any new app: push a
    commit touching `apps/<app>`, `packages/shared` or the lockfile** — any
    of the three, not the app folder specifically. In practice
    `packages/shared` is what fires, because most releases touch it, which
    is why the rule went a day unnoticed: both builds `thefibre-my` has ever
    run were triggered by `packages/shared`, never by `apps/my`.
- **Crawlers**: every app has `app/robots.ts` over one policy in
  `@thefibre/shared/robots`. Open ONLY when `VERCEL_ENV === 'production'`;
  preview, development, absent and unrecognised all close. The visitor
  portal is closed everywhere, production included. Added 2026-09-09 after
  the staging stack was found publicly reachable AND fully indexable with no
  robots file anywhere in the repo. **Never make the open branch the
  default** — a de-indexed production site costs weeks.
  - **Checking it**: `curl https://<host>/robots.txt` on each domain, not a
    local build — only the live domain proves what it serves. Give Vercel a
    few minutes first. Immediately after the 2026-09-09 release four of the
    eight production domains answered **404** and were correct minutes
    later; measured too early you would conclude half the estate is missing
    a robots file.
  - **`my.thethread.app` serving `Disallow: /` on its PRODUCTION domain is
    CORRECT**, not the failure this design warns about. It calls
    `robotsNeverIndex()`: every page below its sign-in is one person's own
    tickets and memberships. Read `apps/my/app/robots.ts` before raising
    it — one session nearly reported it as a broken production site.
- **Env matrix** is machine-checked: `node scripts/verify-vercel-env.mjs`
  (values may be per-project functions — e.g. the two-apex cookie domain).
- **Fly (the API)**: deploy with `./scripts/deploy-api.sh staging|prod`,
  never a bare `fly deploy`. The script refuses uncommitted or untracked
  source (Fly ships the DISK, not the commit), refuses a HEAD that is not
  `origin/staging` (staging) or `origin/main` (prod), and wants to be told
  how the result will be checked (`--probe <path>`, `--behind-auth` or
  `--no-visible-change`). Both apps run in `fra` with
  `strategy = "bluegreen"`, `auto_stop_machines = 'off'` and
  `min_machines_running = 1`; production is 1 GB, staging 512 MB. Because
  blue-green overlaps two processes, every scheduled tick runs under a
  persisted lease (`scheduler_lease`, `lib/scheduler-lease.ts`). Secrets via
  `fly secrets set --stage` so they ride the next deploy instead of
  restarting the machine. **A deploy that fails at the destroy step has
  usually already cut over: re-run the deploy, never destroy machines by
  hand** (`docs/deploy.md`). If the Depot builder will not provision, the
  legacy builder (`--depot=false`) works.
- **Smoke**: `scripts/smoke-staging.mjs` asserts every subdomain serves its
  own app by `<title>`, deriving subdomains from the web apex env — reuse
  the pattern for any domain work.
- The old `*.thefibre.app` app subdomains are GONE (hard cut executed
  2026-09-07: detached from Vercel, transitional `CORS_ORIGINS` removed).
  Old Thread V3 decommission + TransIP record cleanup remain in
  `docs/build-plan.md` (search "TransIP").

---

## 10. Version management & release procedure

### 10.0 The whole thing on one screen

```
your worktree            staging                         production
─────────────            ───────                         ──────────
commit on your   ──▶  runway.sh request --kind release
own branch            (controller: runway.sh clear)
                      release.sh  ───────────────▶  origin/staging
                        │  guard, version surfaces,     Vercel builds the
                        │  pnpm verify, push            .tech previews
                      db-push-staging.sh   (if migrations)
                      deploy-api.sh staging (if apps/api or a package changed)
                                 look at it on thefibre.tech
                                                    ── Sjoerd says so ──▶
                                                    db-push-prod.sh (migrations FIRST)
                                                    promote.sh <sha>  ─▶ origin/main
                                                    deploy-api.sh prod
```

Four facts carry most of it:

1. **A release lands on `staging` only.** Production is a separate,
   deliberate `promote.sh`, and only on Sjoerd's word.
2. **Nothing lands or deploys without a runway clearance** (since
   2026-10-01). One clearance at a time; `release.sh`, `promote.sh` and
   `deploy-api.sh` refuse without it and a pre-push hook covers a bare push.
   The procedure, the vocabulary and the 02:00 escape hatches are in
   [`docs/runway.md`](runway.md); the binding rule is CLAUDE.md rule 4. This
   section does not restate them.
3. **Vercel builds the web apps from the branch; the API is a separate
   deploy.** A release that changes `apps/api` is not live anywhere until
   `deploy-api.sh` runs.
4. **Migrations go before the code that needs them**, staging at release
   and production at promotion.

The rest of this section is the detail behind those four, followed by the
rules that came out of specific incidents. The incident rules read like
pedantry out of context; each one is a thing that went wrong, and the reason
is kept beside the rule on purpose.

### 10.1 Versions and the release commit

- **One monorepo version** stamped in the `package.json` of **every
  workspace package** — root, every `apps/*`, every `packages/*` (shared and,
  since v0.76.0, mcp) — **plus** `apps/web/lib/version.ts` (`VERSION`
  constant — shown in the Fibre sidebar footer and Settings → How The
  Fibre works). `scripts/release.sh` derives that list and refuses a
  half-bumped release; this sentence used to say "nine" and was wrong twice.
  SemVer-ish: features bump minor, fixes bump patch.
- **Per-app user-facing versions are decoupled**: each app shows its own
  number in its sidebar, a `VERSION` constant in
  `apps/<app>/app/(app)/layout.tsx` (My Thread: `apps/my/lib/version.ts`).
  Thread is on `4.x`, Meet on `2.x` (it is the rebuild of Suite v1), Members
  and Connect on `1.x`, Flow, Pulse and Business Models on their own lines.
  Bump those only when app-specific surfaces ship.
  `scripts/check-app-versions.mjs` (run by `release.sh`, warn-only) notices
  an app whose source changed without its number moving.
- **Every release = one commit** containing: the code, every version
  surface (sixteen files today: fourteen `package.json` manifests,
  `version.ts`, the CHANGELOG heading), and a `CHANGELOG.md` entry (top of
  file, dated, narrative style — say *why*, record decisions and reversals
  explicitly). The commit SUBJECT names the version too, and `release.sh`
  refuses a subject that names a different one (§10.v). Groom
  `docs/build-plan.md`'s Open queue in the same ship.
- **Push ONLY via `./scripts/release.sh`** (the version argument is optional;
  it is read from `package.json`). One `set -e` script, born 2026-09-08 after
  a broken `&&` chain pushed past a guard refusal. What it does, in order:
  runway clearance check → `release-guard.sh` (the number is not already
  used) → every version surface agrees (the list is DERIVED from
  `apps/*/package.json` + `packages/*/package.json` + root, never hand-kept)
  → commit subject names the same version → no staged leftovers → HEAD is
  built on `origin/staging` → `pnpm verify` → runway check AGAIN (verify
  takes minutes and the base can move) → `git push origin HEAD:staging` →
  `runway land` → changelog-order and app-version warnings. Then
  `bash scripts/db-push-staging.sh` if the release carries migrations, and
  `./scripts/deploy-api.sh staging` if it changes the API. Vercel builds the
  web apps from the push. When debugging, first verify deployed == committed.

  **Production is promoted, not released** (2026-09-12). `release.sh` used to
  push `main` and `staging` together, so every release built every changed app
  TWICE. Measured over the fourteen days to that date: **2374 builds and 1268
  build-minutes** across nine Vercel projects, against a bill Sjoerd put at
  about €300. Halving the branches halves that, and it finally buys what the
  two-stack setup was for — look at it on `.tech`, then ship.

  So: `./scripts/release.sh <version>` lands on staging. Look at it. Then
  `./scripts/promote.sh` fast-forwards main to whatever staging has, printing
  the range and STOPPING if it carries migrations until you confirm they are
  on production (`MIGRATIONS_ON_PROD=yes`, after `bash scripts/db-push-prod.sh`).
  It needs a `prod` runway clearance, which is only granted with Sjoerd's own
  words. Fast-forward only: if main has commits staging does not, something
  reached production outside this flow and merging it here would be guesswork
  about whose work survives. `scripts/release-guard.sh` now reads the last
  released number from `origin/staging` for the same reason — main lags by
  design, and a guard reading a lagging ref would approve a number another
  session already used.

  **Do not choose the version number by hand.** Write the CHANGELOG entry
  with a `## [NEXT]` heading, then:

  ```bash
  node scripts/next-version.mjs minor          # or patch / major
  git add <your paths> && git commit
  ./scripts/release.sh                         # or with the number, as before
  ```

  **And write that heading at the TOP of the file**, directly under the
  preamble, above the newest release — not under `## [Unreleased]` wherever
  that happens to sit. `next-version.mjs` renumbers the TOPMOST
  `## [NEXT]`-or-version heading it finds, so an entry filed further down does
  not get renumbered; the newest *shipped* entry does, and a release that
  already exists silently takes your number. The `## [Unreleased]` marker is a
  convenience, not a fixed point: on 2026-09-24 it had drifted 440 lines into
  the archive, and inserting "after `## [Unreleased]`" — the obvious move —
  filed four releases below 1.26.0 before anyone noticed. Find the newest
  version heading and go above it; that cannot drift.

  It takes the HIGHEST version it can see — the CHANGELOG headings and the
  manifest on `origin/staging`, the same sources `release-guard.sh` reads,
  plus a peer's committed-but-unpushed release in local history — and stamps
  every `package.json`, `apps/web/lib/version.ts` and the heading. If you lose
  the race while preparing, `node scripts/next-version.mjs minor --amend`
  renumbers all of it and amends the commit; it keeps your title and only ever
  rewrites a heading that is NOT on the release branch. It will not choose
  patch vs minor for you, because that is a judgement about what changed.

  `db-push-prod.sh` and `deploy-api.sh prod` belong with the PROMOTION, not
  with the release — migrations first, then the code that needs them. And
  after any promote, run `supabase migration list` against production: the
  promote only sees migrations in ITS range, so one an earlier promote left
  behind stays invisible (§11.3e).

  **New migrations:** `./scripts/new-migration.sh <name>` picks a version
  that is free in every worktree; never type the fourteen digits by hand.
  `scripts/check-migration-versions.mjs` runs in `pnpm verify` and in the
  runway's preflight and refuses a duplicate. The incident behind it is
  further down this section.

  **`promote.sh` defaults to `origin/staging`, so the range you ANNOUNCE and
  the range you PROMOTE can differ.** Two facts produce it: the script takes
  whatever staging is at when it runs, and docs commits reach staging directly
  (§9, no release, no version bump) — so nothing announces them. A session that
  says "promoting 8ed7ebca → dc9df0b9", then runs a bare promote minutes later,
  can ship two commits it never named and print a range two lines longer than
  it stated. Harmless when they are docs; alarming mid-promotion, which is the
  worst moment to be surprised by drift.

  Both halves are fine on their own — this is the seam between them. Pass the
  sha whenever a range has been stated out loud: `./scripts/promote.sh <sha>`.
  And if you are pushing docs while somebody has announced a promotion, say so;
  they cannot see your commit coming — though note that telling them is not
  the fix. (2026-09-23: exactly this. The session that pushed the docs commits
  flagged it BEFORE the promote ran, and the two commits shipped unnamed
  anyway: the warning lost the race to the push, which is rule 5 from the
  other side. Passing the sha works whether or not anybody's message arrives
  in time; a message does not.)

  **Track `origin/staging`.** This is the one new habit and it bites
  immediately: main lags by design, so the reflex pull leaves a session
  without the last release and release.sh's ancestor check refuses. Caught by
  the Thread session reviewing this change, rather than by the first person to
  hit it in the morning. Merge staging fast-forward before starting and again
  before bumping a version; the refusal message now says so instead of the old
  advice to reconcile, which was right under the previous flow and wrong under
  this one.
  **Docs-only exception** (agreed between sessions, 2026-09-08; amended
  2026-09-12 and 2026-10-01): a commit touching ONLY `docs/**` / `*.md` — no
  code, no version surfaces — skips `release.sh` and pushes with a `docs:`
  prefix **to staging only** (`git push origin HEAD:staging`), under a
  `--kind docs` runway clearance (the controller's preflight refuses a "docs"
  request that touches code). Never to main: a docs commit on main gives main
  a commit staging lacks, and `promote.sh` then refuses the next promotion.
  Anything touching code or version surfaces goes through the script, no
  exceptions.
- **Multiple concurrent LLM sessions are normal** in this repo — and
  increasingly the default way Sjoerd works. The operative checklist lives
  in `CLAUDE.md` under **"Parallel SESSIONS — the serialization protocol"**,
  because that file loads into every session automatically and this one does
  not. (Until 2026-09-09 this bullet pointed at CLAUDE.md for a protocol
  CLAUDE.md did not contain — it documented parallel *subagents* only, and a
  session duly reinvented the protocol from scratch.) The rules, in short:
  - The version files + CHANGELOG are the serialization point — **never
    two sessions in a release at once**. Since 2026-10-01 that is enforced,
    not announced: request a clearance, wait for it, land
    (`docs/runway.md`). Before that the rule was "announce RELEASING NOW",
    and one session lost three races in a row to pushes that outran the
    messages.
  - `git merge --ff-only origin/staging` immediately before bumping — never a
    main-tracking pull, because main lags by design.
  - **Stage explicit paths only, never `git add -A`** — the working tree
    is shared and may hold another session's mid-flight edits. Check
    `git status` column 1 for pre-staged entries; `git diff HEAD -- <file>`
    any shared-ownership file before adding it whole; after committing,
    verify every import the commit introduces resolves within the commit.
  - Fence lanes by directory; coordinate shared files (layouts,
    `packages/shared/package.json`) explicitly.
  - **Announce what you are about to do NEXT, not only what you are doing.**
    A lane claim that names the next task lets a peer see a collision before
    either of you writes the code. 2026-09-09: the thread session mentioned
    that its next page needed "an info popup"; the membership session had
    been offered "a shared info-icon-with-hover" as one of three features.
    Same component, two apps, same evening — caught only because the next
    task was in the claim. Nothing in `packages/shared/src/ui` provided it,
    so this would have been a duplicate the two of us CREATED, which is what
    Components-first (CLAUDE.md, binding) exists to prevent. Cost of the
    catch: three messages. Cost of the miss: two implementations that drift.
  - **A peer's UNCOMMITTED work can block your release.**
    `scripts/release.sh` runs `pnpm verify`, which runs `pnpm -r typecheck`
    over the WORKING TREE, not over your commit. So a third session's
    mid-edit file — a prop passed before it is declared, an import written
    before its target — fails the gate for everybody, and it surfaces as a
    typecheck error in a file you have never opened. **Read the failing PATH
    before assuming the error is yours.** If it is in someone else's lane,
    tell them; do not fix it, and do not work around the gate. First seen
    2026-09-09, the first day three sessions held in-flight code at once;
    found by a session running a cross-check, not by the one that caused it.
    The gate is behaving correctly — this is the shared checkout's cost, and
    the sharpest argument for taking a worktree for code work (CLAUDE.md,
    Parallel SESSIONS): in a worktree it cannot happen.
  - **The worktree decision has to be REVISITED when the work changes
    shape** — not made once at the start. 2026-09-11, three sessions live.
    Two sweeps happened that night, both in the main checkout, both between
    sessions that were being careful. A third session was in a worktree and
    had nothing to sweep, because the shared tree was never visible to it —
    its diff of a twice-swept file, taken against the merge base, came back
    containing only its own edits. The session that got swept had opened on
    a docs question, correctly stayed in the main checkout for it, and then
    never re-decided when the night turned into four releases. **That is the
    failure mode: not declining the worktree, but never asking again once
    docs became code.** (Observed by the session it happened to,
    thefibre-43, and written here at its suggestion.) The practical rule:
    the moment a docs-only session's next step is an edit under `apps/` or
    `supabase/`, stop and take a worktree — `EnterWorktree` mid-session
    costs a `pnpm install` and a merge at the end, which is less than one
    sweep. Over-firing is the safe direction here: the objection is always
    "this one is small", and that is precisely the judgement that failed.
    And the worktree does not merely postpone the sweep to merge time — by
    then the commits exist, and a merge stages nobody's dirty files. What
    *does* still reach you is the bullet above: `pnpm verify` reads the
    working tree, so a peer's mid-edit can still block a release made from
    a worktree-merged commit. That is the gate working, not the worktree
    failing.
    It then bit for real the same evening: v0.68.40 was refused by five
    missing i18n keys and a TS7006 in another session's `engagements.tsx`.
    The releasing session read the path, told the owner, fixed nothing and
    re-ran minutes later. Cost: one release cycle, no correctness.
  - **A repo-wide search is no longer repo-wide: look in every worktree.**
    The advice above worked, and it moved where the work IS. Sessions now hold
    live code under `.claude/worktrees/*`, which `git status`, `git log` and a
    `grep` from the main checkout do not see at all.

    2026-09-23: three migrations were applied to STAGING and existed nowhere
    in git, so `supabase db push` refused for every checkout on the machine
    and a session sat holding its own migration rather than working around it.
    One search reported them "nowhere on disk" — honest, thorough, and it had
    not looked in `.claude/worktrees/`, where all three were sitting in
    somebody's active worktree. We spent that morning telling each other to
    take worktrees and then searched as though nobody had.

    ```bash
    for w in $(git worktree list --porcelain | awk '/^worktree /{print $2}'); do
      ls "$w/supabase/migrations/" | grep -E "<version>"
    done
    ```

    **And stamp the read.** Three sessions reported on those same files inside
    twenty minutes — "nowhere on disk", then "untracked in a worktree", then
    "committed but unpushed" — every one honest, every one stale by the time
    it arrived, and none of them said when it had been taken. In a checkout
    this busy a status read has a shelf life of about a minute; passed on
    without a timestamp it becomes a fact somebody acts on an hour later.

    **The sharp hazard is not what it looks like.** The obvious worry is
    committing somebody else's file. The real one is that copying a peer's
    migration into your tree to satisfy the history check and then running
    `db push` will APPLY it — their unfinished schema change, to a shared
    database, silently, as a side effect of unblocking yourself.

    A session did exactly this on 2026-09-23 and got away with it by
    checking first: of the three files it needed, the third had reached
    remote history in the minutes since its last read, so pushing SKIPPED it.
    Two minutes earlier that same copy would have applied a peer's
    in-progress migration. So: **copying a peer's migration to satisfy the
    history check is only safe for versions ALREADY applied remotely — check
    each one, do not assume, and the answer expires while you work.**

    Two more from the same attempt, both worth knowing before you reach for
    the workaround:
    - A migration authored earlier but pushed later is refused for sorting
      BEFORE migrations already applied. Renumber yours — free while it is
      uncommitted and applied nowhere. Do NOT reach for `--include-all`,
      which inserts it ahead of migrations that are already live.
    - Afterwards, verify the OBJECT (select the new column) rather than
      reading the push log, and remove every borrowed copy.

    The unblocking event is a PUSH, not a commit. "They are committed" reads
    as solved and is not: the files were sealed in a worktree for a while
    before they reached `origin/staging`, and `db push` stayed broken for
    everyone throughout. The rule this repo already had — apply to staging and
    push the FILE in the same breath — is the one that was broken, by the
    session that had relayed it to somebody else that morning.

  - **A lane claim that omits the file you are actually in is not a lane
    claim.** v0.68.40 also swept another session's in-progress work out of
    `apps/thread/app/(app)/threads/actions.ts` — announced four files, and
    not that one, which was the first file it edited. Both halves are
    avoidable and both are already in this list: name every file, and
    `git diff HEAD -- <file>` before staging a shared-ownership file whole.
  - **A server action and the route it calls are a PAIR, and no gate checks
    the pair.** That same sweep shipped a call to
    `GET /thread/threads/:id/engagements/:engagementId/rsvps` while the route
    itself was still uncommitted. **Every gate passed**, because a call to a
    nonexistent HTTP route is not a type error: the import resolved, the
    endpoint did not. It shipped inert (nothing called the action yet) and
    v0.68.41 completed the pair, twelve minutes later.
    **Why no gate sees it, one by one:** typecheck sees a function that
    compiles; unit tests do not cross the wire; `verify-public-api.mjs`
    guards the PUBLISHED contract, not internal routes. So a commit can ship
    one half of a pair with every gate green — not because anyone was
    careless, but because nothing is looking at that seam. It bit in the most
    benign possible way: the half that shipped was the caller, nothing called
    the caller, and the callee arrived minutes later. **Rotate those facts
    even slightly and it is a 404 in production behind a green pipeline.**
    And the cheap mitigation is NOT a new gate — it is that a lane claim
    lists every file you have already touched, which is what stops the halves
    being separated at all. §10 already says "verify every import the
    commit introduces resolves within the commit" — this is that rule one
    level up, so: **if a commit adds a call to an API path, grep the API for
    that path in the same commit.** Framing from the membership session,
    which found it in its own swept work and volunteered it unasked.
  - **A PostgREST select is a STRING, and the type-checker never reads it.**
    Same species as the seam above: a gate-shaped hole where the compiler
    looks like it is helping and is not. Two instances in one session
    (2026-09-10, the member-portal build):
    `organisation:organisation_id (slug)` on `thread_thread` — there is no
    such column, it is `organiser_id`, and the working query eight lines
    above already had it right; and ordering `person` by `updated_at`, a
    column that does not exist either. Both typechecked clean. The first was
    **latent** — its branch only runs for a product carrying a thread link
    and no product has one yet — so no test could have failed and no render
    check could have reached it. The second would have 400'd for every member
    on first load of a new page.
    **Why no gate sees it:** the select is a string literal, so tsc has
    nothing to check; `.select()` returns `any`-shaped rows, so the fields
    you then read type fine whether or not they exist; and PostgREST answers
    a bad column with a runtime `400`, never a build failure.
    **The defence, and it costs a minute:** before shipping, run every NEW
    OR WIDENED select verbatim against real rows — `curl` the PostgREST
    endpoint with the service-role key, or a five-line node script. It
    answers `200` or it names the column you invented, with a hint. Do it for
    reads on production (reads are safe there; see the no-destructive-tests
    rule) or on staging where the table has rows. Both of these were caught
    that way and neither by any gate we own.
    **Two directions, and only one of them announces itself.** A column that
    does not exist gives you a `400` the moment the branch runs. A column
    that DOES exist and was left out of the select gives you `undefined`,
    forever, in silence — which is how `location_url` sat on
    `thread_engagement` for months, stored by the editor and published on no
    surface at all (v0.68.62 on the public thread page, v0.68.63 in the
    portal). Running the select and READING what comes back catches both;
    running it and checking the status code catches only the loud one.
    **Worst in a worker.** A bad select in a request path is reported by
    whoever hit it. A bad select in the five-minute scheduler is reported by
    nobody, forever. The thread session went back and re-ran two it had
    already shipped there — both fine, but it did not know that when it
    shipped them. Three instances between two sessions in one day, none
    catchable by any gate we have, all catchable in ten seconds.
  - **A pipe eats the release guard's exit code.** `./scripts/release.sh X`
    is `set -euo pipefail` inside, but that governs its own internals, not
    the caller's shell. Write `./scripts/release.sh X | tail -4 && fly
    deploy` and `$?` is TAIL's status, which is always 0 — so a REFUSED
    release still runs the deploy, from the working tree, and production ends
    up on code that was never pushed (2026-09-10, the thread session; caught
    and redeployed from the released commit within minutes). This is the
    exact broken-`&&`-chain failure release.sh was written to make
    impossible, reintroduced one level up by piping its output.
    **So: never chain anything onto release.sh, and never pipe it if you
    then branch on the result.** Run it, read what it says, then deploy as a
    separate command. And note there is currently no way to ask the running
    API which commit it is on — `/health` reports only `{ok, service}` — so
    an API running unpushed code is invisible from outside. Putting the
    version in that payload would turn "is production what main says" from a
    guess into a curl.
    **The same pipe swallows git's refusals, and that is the second
    instance.** `git merge --ff-only origin/staging | tail -1` prints
    "Updating <a>..<b>" and then ABORTS if anything is staged — and `tail -1`
    cuts the abort line, so the merge looks done. The connections session
    committed onto the wrong base believing it had rebased, and nothing
    disagreed until release-guard did (2026-09-23). The reliable check is a
    number rather than prose, because a number cannot be truncated into
    looking like success:

    ```bash
    git rev-list --count HEAD..origin/staging   # 0 = you are on top of staging
    ```

    The general rule both instances share: **do not pipe a command whose
    FAILURE you care about into something that reformats its output.** Read
    it whole, or ask a question that answers in a value.
  - **An untracked file in the shared checkout ships on the next `fly
    deploy`, whoever runs it.** Fly uploads the working TREE, not the branch,
    so a stray script belongs to every session's deploy the moment it exists.
    On 2026-09-23 a throwaway that compared `SSO_INTERNAL_SECRET` across the
    Vercel projects sat untracked in `apps/api/scripts/` for hours; the
    Dockerfile's narrow COPY list would have kept it out of the image, but
    the context still crosses the wire to Fly's remote builder. That is the
    same distinction this repo already learned for `.env` (see the comment
    inside `.dockerignore`, 2026-09-11) — out of the image is not out of the
    upload.
    **Check before assuming you are covered:** `.dockerignore` names
    `apps/api/**` under "do NOT ignore", so nothing under it is excluded,
    scripts included. And `apps/api/.dockerignore` is decorative — BuildKit
    never reads it.
    **So:** delete a credential-reading throwaway in the same turn you finish
    with it, and treat `git status` showing an untracked file you did not
    create as somebody's live exposure rather than clutter.
  - **A duplicate migration VERSION does not sort — it disappears.** Supabase
    keys the migration history on the 14-digit version, NOT the full filename
    (`supabase migration repair [version]` takes the digits, and nothing else
    identifies a row). CLAUDE.md's gotcha says "tracks applied migrations by
    filename, not checksum", which means *not by content hash* and reads as
    *by the whole name* — that reading is wrong, and it is what produced this
    entry.

    2026-09-23, two sessions in disjoint lanes: one released
    `20260923140000_meet_host_busy_includes_free`, the other was holding
    `20260923140000_thread_task`. The second was pushed AFTER the first had
    been applied, so `supabase db push` considered that version already
    applied and **skipped it silently** — log listing only the sibling
    migration, exit 0, table simply absent. Caught only by probing the
    database for the table afterwards instead of believing the push log
    (the same "failure prints something that looks like success" family as
    the piped-`--ff-only` trap above). It then left the repo in a state where
    the next push refused with "Remote migration versions not found in local
    migrations directory" and suggested
    `supabase migration repair --status reverted 20260923140000` — which
    would have marked a PEER's genuinely-applied migration as reverted. Do
    not run a repair the CLI suggests against a version you did not write.

    **So:** before choosing a timestamp, look at every worktree's
    `supabase/migrations`, not just your own repo view — a peer's unpushed
    file is invisible to `ls` in the main checkout and claims the number
    anyway. And after any `db push`, verify the OBJECT exists rather than
    reading the log.

    Third of its kind: this, the machine-global `supabase link` (which is why
    `db-push-staging.sh` restores the prod link in a trap), and the shared
    stash stack. All three are sessions in disjoint lanes, touching no common
    file, colliding through state the directory-lane protocol cannot see.

  - **A conclusion is scoped to what produced it, and a grep is shaped by
    what you expected.** Three instances inside one exchange on 2026-09-23,
    all the same move, two of them one message away from reaching a third
    session as fact.
    1. `verify-sso-hop.mjs`'s rule — "POST 403 → the app's
       `SSO_INTERNAL_SECRET` differs from the API's" — is real, and belongs
       to `POST /api/v1/sso/redeem`, the cross-apex hop. It was carried to
       `/oauth/me`, which presents no secret at all, and would have had
       somebody hunting config while the membership gate worked correctly.
    2. Corrected to "it belongs to the token POST" — also wrong. At
       `/oauth/token` a bad `client_secret` fails `secretMatches` and returns
       `invalid_client` **401**.
    3. Enumerating the 403s by grepping `", 403)"` returned ZERO hits, on a
       file with two of them, because both are multi-line
       `c.json({ … },\n  403,\n)`. That nearly became "the file contains no
       403 at all".
    **The settled rule for the OAuth provider**, which is what the endpoints
    actually do: `403` = membership not active (the only 403 in the file);
    `401` = credential or token wrong; `400` = request or grant wrong.
    A fourth followed the same day, from the membership session and caught
    inside it: probing production for a `todo` table after reading only the
    migration's FILENAME, `todo_is_an_org_feature`. There is no such table —
    the file updates `billing_plan.features` and nothing else — and the
    `PGRST205 table not found` was one step from being reported as a failed
    migration on a freshly promoted production.
    **The habit:** a status-code-to-cause mapping belongs to the endpoint it
    was measured on and travels nowhere on family resemblance. A grep that
    finds a shared symbol says nothing about the role that symbol plays where
    it was found — so when a pattern returns zero on a file you expect hits
    in, doubt the pattern before the file. And a migration's filename states
    the INTENT, not the objects it touches.
    **What actually fixes it is not care, it is order.** All four had the
    same shape: the cheap instrument agreed with the expectation, and the
    authoritative one — the `.sql` file, the handler source, the endpoint
    itself — was seconds away. So go to the authoritative thing BEFORE
    forming the sentence, rather than after the cheap one alarms you. Three
    of the four left the session that made them; the one that did not was
    caught only because its alarm was loud enough to be worth a second look,
    which is too thin a margin to rely on.
- **Verification is part of the release** — the full testing approach is
  §11; the per-release gate checklist is §11.4.

---

### 10.x A staged-file check that filters OUT staged files

2026-09-25. Rebasing a release in the shared checkout, I resolved a peer's
conflicted commit, reported "version files + CHANGELOG only, no code", and
was wrong: `apps/api/src/lib/message-tokens.test.ts` — a test another
session had amended into its own commit about a minute earlier — rode into
MY commit instead. The peer found it by listing the files rather than
believing my summary.

**Two different things went unchecked, and only one of them is the famous
one.**

1. The conflict list is not the commit contents. `git status --porcelain |
   grep '^UU'` answers "what did git fail to merge", which I read as "what
   is in play". A file that was cleanly STAGED by somebody else is not
   conflicted and never appears there.

2. The guard I ran was structurally incapable of firing:

   ```bash
   git status --porcelain | grep -v "^M \|^A " || echo "(all staged)"
   ```

   It prints what is NOT staged. A peer's pre-staged file shows as `A ` or
   `M ` in column 1 — precisely what the `grep -v` removes. It printed
   nothing, I read "(all staged)" as "only my work is staged", and committed.
   CLAUDE.md §3 says *check column 1 for someone else's pre-staged entries*;
   I had inverted it into a check for unstaged leftovers.

**The principle, which is bigger than this bug.** Two sessions ran checks
with identical intent that night. Mine filtered to what looked staged and
could not fire; the other filtered out its own paths and asked what was
LEFT — and its eleven release commits were clean. The difference was not
care. It was which set gets enumerated:

> **Enumerate the leftovers, never the expected.** A check that lists what
> you expect and finds it will always pass.

**What to run instead.** Compare the staged set against the paths you
intended, and look at what is left over — which also makes "intended" an
explicit list rather than something you hold in your head:

```bash
git diff --cached --name-only | sort > /tmp/staged
printf '%s\n' "${INTENDED[@]}" | sort > /tmp/intended
comm -23 /tmp/staged /tmp/intended   # staged, but NOT yours — stop here
```

Nothing was lost (the test is on staging and passing, and it belongs to the
same change either way) and the history was NOT rewritten to move it —
rewriting pushed history to relocate one file costs more than the confusion
it saves. The cost is a reader finding a rich-text token test inside a
commit called "the share link is our invoice", which is what this entry
exists to explain.

**Root cause, and the fix that actually holds:** the peer's commit was
local and unpushed, and `scripts/next-version.mjs` read only `origin`, so
it offered an already-taken number twice. It now takes the highest of
`origin` AND `HEAD`. Being more careful was never going to be the fix.

### 10.z Which session made a commit is not in the commit, except in one line

Every commit in this repo carries Sjoerd's git identity, because every session
runs as him. So `git log --author` cannot answer "whose lane is this", and the
shared checkout means a freshly-made commit is visible to sessions that had
nothing to do with it.

What settles it is the trailer:

```bash
git show --format='%an%n%b' --no-patch <sha> | grep -i 'co-authored-by'
```

Different sessions run different models, so `Co-Authored-By: Claude Opus 5`
and `Co-Authored-By: Claude Fable 5.1` are different authors even when the
committer is identical. Where a finding and its write-up belong to different
sessions, the body usually says so — read it before deciding.

**Three misattributions between two sessions in one night, all in the same
direction: each guessed the author was whoever they had been talking to.** One
session assumed a peer's release was the peer's because they were mid-thread
with them; another corrected an attribution to a colleague and handed it one
session too far, to the person who had FOUND the thing rather than the one who
wrote it up. None of the three cost anything, because each was raised rather
than quietly assumed — which is the actual rule:

> In a shared checkout, **guessing an author from context is a coin flip**.
> Read the trailer, or say "I think this is yours" and let them answer.

Getting it wrong matters most where the record outlives the conversation:
whoever reads a commit in six months has only the trailer and the body, and
a confident wrong attribution in a handover note is worse than an open
question.

**The same failure with option numbers, an hour later.** A decision doc listed
two safe shapes as 1 and 2. One session then summarised them to Sjoerd in the
other order, because it led with the one both sessions preferred. Two of us
were confidently agreed on "(2)" while one meant the opposite thing, and a
"do 1" from him would have built the option neither of us wanted.

> **Name the mechanism, never the ordinal, once it leaves the document.**
> "Stamp `verified_at` at merge" survives being quoted, forwarded and
> half-remembered. "Option 2" is only true next to the list it came from.

Same shape as the attribution above and as §11.3d: a confident match on a
token that does not carry the meaning. Numbers inside a doc are fine — they
stop being safe the moment they travel.

### 10.y The Fly builder OOMs on `tsc`, and a retry hides it

Same day: two sessions within an hour had
`pnpm --filter @thefibre/api... build` die in the Fly image build with
**SIGKILL** — an out-of-memory kill in the builder, not a type error, and
the local `pnpm -r typecheck` passes. Both retries succeeded, which is
exactly how this becomes invisible.

Retry once. If a third session hits it, the remote builder needs more
memory rather than more retries — that is an infrastructure change and
Sjoerd's call, not something to keep absorbing.

### 10.w An abandoned release leaves its version stamp in the tree

`next-version.mjs` stamps sixteen files and `release.sh` commits them. If
the release is then amended, reset or simply dropped, **the stamp stays
uncommitted in the working tree** — and in the shared main checkout that is
indistinguishable, in `git status`, from a release in progress.

On 2026-09-25 a v1.60.0 release was amended and left every manifest sitting
at 1.60.1. They were still there on 2026-09-27, seventeen releases later.
Anything that committed them — a release run from that checkout, or one
`git add -A` — would have sent every manifest and the sidebar footer from
1.77.0 back to 1.60.1, in a commit touching exactly the files a release
touches. Nothing looked wrong for two days.

`scripts/check-version-residue.mjs` now runs first in `pnpm verify` and
refuses an uncommitted version stamp that is not strictly greater than the
released version on `origin/staging`. That predicate is what makes it safe
inside verify, which `release.sh` calls after stamping and before
committing: a live release's stamp is higher and passes, residue is lower or
equal and is refused. It only judges a manifest whose version FIELD changed,
so adding a dependency at the current number is not a finding.

Two lessons beyond the script. **A shared checkout's `git status` is not a
diff of your own work** — fourteen modified manifests look like somebody
mid-release, which is why nobody looked. And **the residue of a correct
process is still a hazard**: nothing here was done wrong except failing to
clean up after changing one's mind.

### 10.v The commit subject is a version surface, and nothing stamped it

`next-version.mjs` stamps sixteen files. The commit message is typed by hand
BEFORE it, so when a lost race moves the number, `--amend` restamps every file
and cannot reach the subject line — and git history then names a version the
commit did not ship, permanently.

Four of the last 120 release commits on `staging`: e06f90ab says `v1.76.0` and
shipped 1.79.0, 63b68e40 says v1.75.1 and shipped 1.76.1, plus 61d3f61b and
a873ac56. All recent, because renumbering only became routine once several
sessions released in one day. The CHANGELOG is right in every case, which is
why it stayed invisible — the mismatch exists only between two places nobody
compares. It bites when someone asks which commit shipped a version: the
answer read off `git log` is the wrong commit.

`release.sh` now refuses a commit whose subject names a version other than
the one being released, and says to `git commit --amend`. A subject that
names no version — a docs commit — is ignored.

The same drift reaches the ANNOUNCEMENT: a session said `RELEASING NOW
v1.81.0` and landed 1.82.0 on 2026-09-27. Nothing can gate a message, so say
the number again in `released <sha>` and treat the first one as provisional.

## 11. Testing

Full rationale and roadmap: `docs/testing-approach.md`. This section is the
operational summary.

**Where it stands:** four layers exist and run — a strict type system, unit
tests (Vitest), integration tests against the real staging database, and
Playwright against the staging stack — plus the executable contract checks.
The counts are measured, not remembered, and live in ONE place:
`docs/testing-approach.md`. The guiding rule: **test the promises, not the
plumbing** — contracts (published APIs, money, sign-in, RLS tenancy) get
tests; UI plumbing gets types and render checks. So coverage is deliberately
uneven: the API, the shared package and Connect carry the unit tests; seven
of the ten web apps have none.

**What a green run does and does not mean.** It means the promises hold. It
does not mean the screens are right (hence the render-check rule), and it
does not mean an integration works: in one evening on 2026-10-01 three faults
shipped through typecheck, unit tests and review, and all three were caught
the same way — by reading the thing on the OTHER side (Zoom held every
meeting two hours early; nothing had ever read a meeting back). **The
system's agreement with itself is not evidence.** For anything that crosses
to an external system, the check that counts reads it back from there.

### 11.1 Internal vs external testing

Two senses, both used:

- **Who tests**: *internal* = the developer/LLM loop (local + staging) and
  **dogfooding** (Solidarity Lab runs its own events, memberships and
  cashflow on production — that is the alpha programme). *External* = the
  comped closed-beta workspaces (created at /admin/workspaces with a
  reason, each with a named contact; feedback lands in build-plan's Open
  queue) and then open self-serve use. Beta users are real users: full
  GDPR posture, never destructive tests on their data.
- **What's tested**: *external (black-box)* tests exercise published
  surfaces as an outsider — our verify scripts are exactly this and are
  the most valuable tests we own. *Internal (white-box)* unit/integration
  tests guard intricate algorithms (money, tenancy). Bias: contracts get
  external-style tests (they survive refactors); algorithms get internal
  ones.

### 11.2 The layer stack (cheap/always-on → expensive/occasional)

1. **Types** — `pnpm -r typecheck`; typed i18n catalogs and API shapes are
   free regression coverage. Prefer making an invariant a type over a test.
2. **Contract checks** — `apps/api/scripts/verify-external-app.mjs`
   (the whole external-app contract, throwaway app, self-cleaning),
   `apps/api/scripts/verify-public-api.mjs` (Thread public reads: shapes,
   CORS, rate limiting), `scripts/smoke-staging.mjs` (each domain serves
   its own app by `<title>`), `scripts/verify-vercel-env.mjs` (the env
   matrix as executable truth).
3. **Unit tests** — Vitest, `pnpm test` (`pnpm -r test`): pure logic —
   fees, VAT, plan gating, `sso-hop.ts` sanitisation, membership intervals,
   calendar invites, the MCP tool table, the design tokens, Connect's
   components.
4. **Integration tests** — `pnpm test:integration`: API routes run IN
   PROCESS behind the real middleware against the **staging database**, with
   throwaway workspaces and real minted sessions. The anon floor over every
   table, the two-user cross-workspace RLS matrix, SECURITY DEFINER
   exposure, tenancy attacks on service-role routes, purchase idempotency,
   the SSO single-use race, the scheduler lease. Real Postgres always —
   mocking the DB tests nothing, RLS is the point. Not in CI (it needs
   staging credentials); `pnpm verify:full` runs it locally.
5. **E2E** — Playwright, `pnpm test:e2e`, against the staging stack: golden
   paths plus signed-in render checks. A session is obtained by minting a
   single-use SSO handoff code for a fixture user (`e2e/helpers.ts`), so no
   inbox or password is involved. Not in CI.
6. **Manual/visual** — signed-in browser render check for every
   shell/chrome/layout change (typecheck-clean ≠ render-correct); the
   staging live-test loop is a first-class technique.
7. **Production monitoring as testing** — API stderr (verbose on purpose),
   Stripe webhook delivery status, Vercel deploy status, prod smoke.
   Silence is not success: read the log after shipping money/auth changes.

Deliberately not done: UI snapshots, mocked-DB tests, coverage targets,
load testing (revisit at the first >5k-person workspace).

### 11.3 Test data rules

Real database, fake money (Stripe test keys), fake people (seed fixtures —
`apps/api/scripts/seed-ebbf.mjs` is idempotent). **Never destructive writes
against production data** — reads on prod are fine; writes need a fixture
workspace or an explicit check-in first. Rehearse risky flows (payments,
erasure, cutovers) on staging or a Solidarity-Lab-owned prod fixture.

### 11.3b `revoke ... from public` does NOT close a function on Supabase

**Every new function in the `public` schema is executable by the `anon` and
`authenticated` roles unless you revoke those roles by name.** Supabase grants
them EXECUTE separately, through default privileges. `revoke all on function
f from public` removes only the implicit Postgres grant to PUBLIC and leaves
both of Supabase's in place. The anon key ships in every web bundle, so an
unrevoked SECURITY DEFINER function is callable by anyone on the internet
straight through PostgREST, with no session, and RLS does not apply to it.

Found 2026-09-13. The Connections session found its read functions leaking
people data to the anon key; a sweep of every SECURITY DEFINER function on
production then found `resolve_sso_identity`, `ensure_workspace_member` and
`ensure_user_person` open too — functions that link external identities to
accounts, plant accounts in workspaces, and add any user to any workspace. All
had been "locked" with `revoke ... from public`, by authors who reasonably
believed that closed them. Fixed in 20260913071000–073000, promoted the same
night.

**The pattern for a function only the API should call:**

```sql
revoke execute on function public.f(uuid) from public, anon, authenticated;
grant  execute on function public.f(uuid) to service_role;
```

For a function redefined more than once, revoke by OID across every overload
(see `20260913073000_revoke_identity_functions.sql`) — a REVOKE naming a stale
signature errors, or silently leaves the live overload open.

**The exception that must NOT get this treatment:** a function evaluated
inside a row policy — `can_see_person` and friends — runs AS the querying role.
Revoke it from `authenticated` and every policy calling it fails, and every
signed-in user sees nothing. Those need `anon` revoked and `authenticated`
kept, or a design that does not take the target as a parameter.

**How to check a function without running it:** call it as anon with a
malformed uuid for a uuid parameter. Postgres checks EXECUTE privilege first
(`42501` — closed), then coerces arguments (`22P02` — the role may execute, and
the body never ran), then runs the body. So the probe is safe even on functions
that write. Calibrate it first on one function known to be closed and one
known to be open; the ordering is what makes it trustworthy, and it was
observed, not assumed. A function whose parameters are all text cannot be
probed this way — coercion will not stop its body.

**The mirror-image mistake, found 2026-09-14.** `revoke ... from anon` alone
does not close a function either: a function nobody ever "locked" still holds
Postgres's implicit grant to PUBLIC, and anon is a member of PUBLIC. The first
migration of that day revoked anon from every definer function and the probe
still found four open — the four that had never had a REVOKE of any kind. Both
revokes are needed; `from public, anon` in one statement is the habit.

**Since 20260914171000 the default is closed.** The default privileges for
functions the `postgres` role creates in `public` no longer grant EXECUTE to
PUBLIC or anon, so a function born after that migration is executable by
`service_role` and `authenticated` and nobody else. Consequences for an author:
a new RLS helper needs nothing extra; a new service-only function needs one
line, `revoke execute on function public.f(...) from authenticated`. Every
definer function that existed before was revoked from PUBLIC and anon by OID,
and the nine reviewed RLS helpers were granted to `authenticated` explicitly
(they had been reaching it through PUBLIC).

**The standing guard.** `apps/api/scripts/lib/definer-probe.mjs` reads every
SECURITY DEFINER function out of `supabase/migrations` (latest definition
wins, in filename order — the same order Supabase applies) and runs the
calibrated probe. Two callers: `scripts/audit-definer-functions.mjs` prints the
table for any project, read-only (`FIBRE_ENV_FILE=.env.staging`, or `.env` for
production, or `FIBRE_BEARER=<token>` to probe as a signed-in user); and
`src/integration/definer-functions.int.test.ts` runs in `pnpm test:integration`
against staging with a throwaway signed-in fixture, asserting anon may execute
none, authenticated may execute only the allowlist in the probe module, and —
the success twin — that the allowlisted helpers ARE open to authenticated. A
function the test names is open to a role the allowlist does not cover; either
revoke it or add it to the allowlist with a comment saying which caller needs
it. The allowlist is the review record.

### 11.3a A refusal test needs a success twin

**A test that asserts a request is refused cannot, on its own, tell a working
check from one the request never reached.** Pair every refusal with the
nearest request that must SUCCEED — same route, same caller, same fixture,
one thing different. If the refusal passes and its twin also fails, the
refusal was never testing your check.

Found 2026-09-13 writing `apps/api/src/integration/thread-tenancy.int.test.ts`
for the cross-workspace fix in v0.73.19. The co-organiser refusal test —
"an admin cannot add somebody from another workspace" — passed. Its twin,
"an admin CAN add somebody from their own workspace", failed with the same
404. The fixture admin had no Thread `app_membership`, RLS on `thread_thread`
hides a thread from such a user, and the route checks visibility through RLS
BEFORE the tenancy check. Both requests stopped at that earlier gate. The
refusal was green and proved nothing.

Two companion habits that made the rest of that suite trustworthy:

- **Run the suite against the unfixed code.** Swap the old route in, run it,
  put the fix back. The refusal tests must FAIL there and the success twins
  must pass on both. That suite: 16/16 fixed, 11 failing unfixed — one per
  hole — with the 5 legitimate paths green either way. A security test that
  has never been seen to fail has not been shown to detect anything.
- **Check the schema before tightening a filter.** The same fix nearly scoped
  an organiser lookup by workspace. `thread_organiser.user_id` is UNIQUE
  across the whole platform, so that filter would have 500'd every
  co-organiser invite for anybody in two workspaces. A filter that looks like
  tightening can break a legitimate path; scoping is not automatically safe,
  and "add a workspace filter" is exactly the reflex a tenancy fix produces.

Unit tests can satisfy the rule by accident — `workspace-refs.test.ts` pairs
"accepts a person in the caller's own workspace" with "refuses one in
another" — which is the argument for stating it: a rule followed by accident
is not followed by the next test.

### 11.3e Before a PROMOTE: check for migrations an earlier promote left behind

*(Renumbered 2026-10-01: three sections had shared the number 11.3b. The
definer-functions section keeps it, because code and other documents cite it
by that number.)*

`scripts/promote.sh` refuses when the range it is promoting **adds** a
migration, unless `MIGRATIONS_ON_PROD=yes` says the push has been done. That
guard is correct and it is not enough, because it only looks at its own range.

**A migration that an EARLIER promote failed to apply is invisible to every
later one.** The range no longer adds it — the file was already on main — so
promote.sh sees nothing to warn about, and production goes on running code
against a table that is not there.

That happened on 2026-09-21. The promote to v0.87.1 shipped three migrations'
worth of code without pushing them:

  20260921150000_mcp_grants.sql        the assistant grant table
  20260921160000_curator_updated_at.sql the updated_at triggers
  20260921170000_connect_rename.sql     the catalogue rename

For the hours in between, `/connect → Allow` on production would have failed
on a missing table. Nobody pressed it. That is luck, not a gate.

**So, before every promote:**

```bash
supabase migration list        # the CLI is linked to prod by db-push-prod.sh
```

Any row with a LOCAL version and an EMPTY remote column is a migration
production does not have. Push before you promote:

```bash
./scripts/db-push-prod.sh
```

The same check is worth running after any promote somebody else made, for the
same reason: nothing in the flow notices the gap on its own.

### 11.3f An empty answer is a finding; a plausible one hides the same fault

**When a call comes back with nothing in it, that silence is the most
informative thing you will get all day — go and read the log.** A plausible
body would have been filed as success and the fault would have gone to a user.

2026-09-24, testing a calendar cancellation. `POST .../calendar-changes/send`
returned an EMPTY body. The API log had the whole story: Fly had closed the
connection about twenty seconds in ("connection closed before message
completed") and the machine failed a health check going past, because the
handler was holding the request open for one email per recipient per change,
paced at the mail provider's ceiling. Forty people and three changes is over a
minute of work inside one request.

The second fault is the one worth remembering, because of its SHAPE:

> The queue was marked sent only after the whole loop, while the per-session
> `calendar_sequence` was advanced as each message went out. So an interrupted
> run left every change looking untold with the counters already moved on —
> and the obvious recovery, press the button again, would have re-invited
> everyone who had already heard.

**A bug whose remedy makes it worse gets found by a user, not by us**, because
the first thing anybody does is retry. When work is a loop over recipients,
record progress per ITEM as it completes, so an interrupted run is safe to
leave interrupted; and refuse a second press while the first is in flight,
since that is exactly the button people press twice when nothing appears to
happen.

Same week, same lesson one level up: our own send log said "14 of 15 sent",
which was true and told us nothing — the mail left correctly and the
recipients' calendars declined it — our logs witness what we sent, never
what the other side did with it (the opening of §11). Both times the answer came from looking at the thing itself: the
server's log, and a rendered message in a real inbox.

### 11.3d A check that passes for the WRONG REASON looks exactly like one that passes

2026-09-25, from a session verifying that rich text had been stripped out of
a calendar feed. The first check grepped the whole `.ics` document for tags
and found none — which would have reported success even if every VEVENT had
been full of markup, because the string it actually matched was the
calendar-level `DESCRIPTION`, not the event's. It was caught only because
the line it printed was visibly not the one it meant to check.

So: make the assertion name the exact thing under test (`DESCRIPTION:` INSIDE
the `VEVENT`, for a session whose description you planted), and read what the
check matched, not just whether it matched. Sibling of §11.3f — an empty
answer is a finding, a plausible one hides the fault — and of the
enumeration rule in §10.x: all three are the same failure wearing different
clothes, a green that could not have gone red.

### 11.3c A DEGRADED answer is worse than an empty one — and worst pointing the safe way

§11.3f is about a call that returns NOTHING. This is its sibling and the more
dangerous half: a call that returns a plausible answer it invented.

`const { data } = await q; return data ?? []` turns a database error into a
result. An empty response at least looks like nothing; a defaulted one looks
like a finding. `lib/rows.ts` exists to refuse that — `rows()`, `row()` and
`count()` read the error the query returned and throw it, so the route answers
500 and the log names the query.

**Use it on every read whose EMPTY case means something to the person looking
at it.** Decoration may degrade — a missing label, an avatar that does not
load. A list may not, and a COUNT may not.

**Then ask which direction the default points**, because that is what decides
how much it costs. Both of these are one line of code and they are not the
same mistake:

> A visitor's ticket list that fails to `[]` says "you have no tickets". Wrong,
> alarming, and instantly disbelieved — the person knows they have a ticket.
>
> `lib/portal-erasure.ts` counts the people whose places depend on an
> organiser's account before it lets them ask to be erased. Every `?? []` and
> `?? 0` in it resolves to **"nothing blocks this request"** — the answer that
> looks fine, reassures the person asking, and omits the warning from the note
> handed to whoever processes it. Fifteen people's places, silently unmentioned.

The second is worse in every way that matters: it is not disbelieved, nobody
reports it, and the harm lands on people who were never in the conversation.
So when a read can fail, do not only ask "what will it return" — ask **"is the
default the reassuring answer or the alarming one?"** A default that reassures
needs to throw. A default that alarms will at least be reported.

This is not hypothetical in that file. It shipped with `from('"user"')`, which
PostgREST answers PGRST205 to; the error fell into an empty list and the
function reported "nothing blocks this" for every organiser on the platform
(v1.55.0, fixed before release by running the selects against a real
database — the "a PostgREST select is a string" rule in §10). The rule and
the bug were found the same week, from opposite ends.

### 11.4 Release gates (run per release)

`release.sh` runs gates 0 and 1 itself; the rest are the releaser's.

0. `./scripts/release-guard.sh` — refuses a release number that does not
   beat the highest version on `origin/staging` (CHANGELOG headings and the
   manifest). Born 2026-09-07 after three same-number collisions between
   concurrent sessions: **history is the serialization truth; announcements
   are courtesy.**
1. `pnpm verify` — always. In order: version residue, migration versions,
   the runway's own test, service-worker freshness, catalogue names against
   `branding.ts`, `pnpm -r typecheck`, `pnpm -r test`, the production smoke,
   and the public-API contract against production. In a worktree it needs
   `FIBRE_ENV_FILE=<absolute path to apps/api/.env>`, because that file is
   gitignored and exists only in the main checkout.
2. The verify script for any touched contract area (`/api/v1/apps/*` →
   verify-external-app; Thread public/CORS → verify-public-api;
   env/domains → verify-vercel-env + smoke).
3. Shell/layout change → signed-in render check.
4. Money/auth change → staging rehearsal with test keys, then watch the
   API log during the first prod exercise.
5. Migrations → applied to staging at the release (`db-push-staging.sh`)
   and to production at the promotion, BEFORE the code (`db-push-prod.sh`).
6. After an API deploy: the probe `deploy-api.sh` asked for, the smoke for
   that stack, and the Fly log.

The multi-session serialization protocol (§10) is part of testing: one
landing at a time and explicit-path staging keep other sessions'
half-finished work out of the tested artifact.

### 11.5 What runs where

| | Where it runs | What it covers |
|---|---|---|
| `ci.yml` | GitHub, every push to `main` and `staging`, every PR | builds the packages, `pnpm -r typecheck`, `pnpm test`, then a real build of the platform app and the API. It does NOT build the other nine Next apps |
| `nightly-contracts.yml` | GitHub, 04:17 UTC | the production and staging smokes |
| `pnpm verify` | the releaser's machine, inside `release.sh` | gate 1 above |
| integration and E2E | the developer's machine, against staging | not in CI — they need staging's service-role key |
| the periodic stress round | a session, on request | every layer above plus the contract walks, the audits on both stacks and targeted hunts; records in `docs/stress-test-*.md` |

CI is a second opinion, not the gate: it was red for two days in September
without anyone noticing, because the gate people actually pass through is
`pnpm verify`. Cost profile: tooling €0, CI within the free tier; the real
cost is the two to five minutes of gates per release.

---

## 12. Working on this codebase

### Local dev

```bash
export PATH="$HOME/.local/bin:$PATH"
cd ~/Projects/thefibre
pnpm install
pnpm --filter @thefibre/shared build && pnpm --filter ./packages/mcp build
pnpm dev          # every app's dev script in parallel: api :8080, web :3000,
                  # meet :3001, thread :3002, flow :3003, pulse :3004,
                  # membership :3005, website :3006, my :3007,
                  # connections :3008, models :3009
                  # the truth, when this comment has gone stale:
                  #   grep -h '"dev"' apps/*/package.json
```

Node 22 (the Dockerfile and CI both use it; `engines` says `>=20`), pnpm
9.12 (pinned by `packageManager`). **There is no local database in normal
use**: local dev talks to a hosted Supabase project through `apps/api/.env`
— production on most machines, `apps/api/.env.staging` for staging
(`FIBRE_ENV_FILE=.env.staging` selects it for the scripts). So a local write
is a real write: use staging for anything that changes data. And
**`pnpm db:migrate` is `supabase db push` against whatever project the CLI is
linked to** — use `scripts/db-push-staging.sh` / `db-push-prod.sh`, which
link explicitly, and never the bare alias.

Only some apps have local `.env.local` (web has the full set incl.
`SSO_INTERNAL_SECRET`); apps without one render public pages but can't
sign in locally — that's known, not broken. Seed realistic data:
`cd apps/api && node scripts/seed-ebbf.mjs` (idempotent; builds the brief
§8 worked example). After a burst of many file changes (e.g. parallel
agents), the Next dev server can wedge — kill and restart `pnpm dev`.

### Sharing a constant between a server and a client component

A **value** read by both a server component and a `'use client'` one must
live in a module that is neither. Next replaces a client module's exports
with proxies and erases the types, so a constant exported from a `'use
client'` file and imported by a server component typechecks and then crashes
on first render — a local `next build` does not catch it. Two such modules
exist for exactly this reason: `apps/connections/app/(app)/today/shape.ts`
and `apps/connections/app/(app)/landscape/axes.ts`.

A **type** crosses freely from anywhere, as long as the import says `import
type` — it is erased before Next builds a module graph, so no proxy is ever
made. `apps/thread/lib/public-site.ts` is read by nine server components and
one client component and survives on precisely this, which also means it
survives by accident: nothing in the file says so, and the first person to
import a VALUE from it there will find out the hard way.

The trap is the const that reads like a type. A label map, a list of stages,
a lookup table — all values.

### A derived view over empty data looks WRONG, not empty

Found in Connections on 2026-09-12 and general to every app here, because
every app here computes a view from data another app filled in.

**A rule written from one surface is not yet a rule, it is a description of
that surface.** Both halves of this section were written that way and both
were wrong until a second session tested them against a second surface — the
"never hide it" version would have put teaching copy under every quiet
Tuesday on Thread's home page, and the shape-of-the-view condition shipped as
a live bug in Connections. So: test a general claim against a surface you did
not write it from BEFORE it goes in, and treat "it survives" as a finding
rather than a formality.

Empty is honest and legible: no rows, one sentence, done. The failure mode is
different and worse — a view that computes **correctly over nothing** and
renders a confident, fully-formed answer. One bar at 100%. A chart with a
single flat line. A score of zero presented as a score. The reader cannot
tell a true statement about a young workspace from a broken page, and the
more polished the rendering, the more it reads as a bug.

The concrete case: three of Connections' five landscape axes put every person
in one band, because those axes read captured conversations and recorded
introductions and nothing had written either yet. Correct arithmetic, and it
looked broken. Sjoerd's report was *"I dont get what it is doing now"*.

**First decide WHICH emptiness it is**, because there are two and they want
opposite treatments.

*Transient* empty is a healthy workspace on an ordinary day: nothing on
today, nobody enrolled this week, no invoice outstanding. It recurs forever,
it is unremarkable, and a sentence teaching the reader how to fill it would
appear every quiet Tuesday and become exactly the permanent furniture this
rule is trying to prevent. **Hide it.** That is the correct answer, not the
lazy one — Thread's home page hides a section with nothing in it for this
reason, and should keep doing so.

*Structural* empty is the case above: a source that has never been written to
at all, so the view is not reporting a quiet week, it is reporting that a
feature has never been used. **That earns the sentence.**

The test between them is not "is it empty now" but "has anything ever been
here". (Split added 2026-09-12 by the Thread session, testing the rule
against a real dashboard at the author's invitation; the original text said
simply "do not hide", which would have put teaching copy under every quiet
Tuesday on Thread's home page.)

**For the structural case, do not hide the section.** Hiding is the cheap fix
and it costs the teaching moment, which is the one thing a day-one workspace
needs; it leaves a short page that explains nothing. Instead say three things
in one breath:

1. what the surface is reading from,
2. that the source is empty,
3. the single action that would fill it — *"Write down a conversation on a
   person and this axis starts working."*

**Compute the condition from the data, never from a flag or a first-run
check.** Then the sentence appears only while it is true and disappears by
itself the moment it stops being true, instead of becoming permanent
onboarding furniture somebody has to remember to switch off.

**Point that computation at the SOURCE, not at the shape of the view.** "One
occupied band out of five" also describes a workspace where everybody
genuinely has been spoken to and nobody has been introduced — a true, stable
answer the sentence would then nag at forever. "Zero conversations have ever
been captured here" is the fact that actually makes the axis uninformative,
it is the fact the sentence promises to change, and it stops being true
exactly once.

The source-not-shape correction above is not theoretical: Connections
shipped the shape version in v0.73.6 and it was a real bug for half an hour.
"Everybody in one band" also fires on a workspace where every person sits at
`committed`, which would have been told to go add something to the pipeline
it already has. The fix is `AXIS_UNWRITTEN_BAND` in
`apps/connections/app/(app)/landscape/axes.ts` — per axis, the band a person
falls into when nothing has been written — and the sentence renders only when
the single occupied band is that one. For those five axes it is equivalent to
counting the source and needs no second query; an axis whose bottom band were
reachable with a non-empty source would need the real count.

Applies to: the Connections landscape (done), Thread's home page, Pulse's
dashboard, and anything else whose numbers come from a table a different
app writes.

One honest instance of the same sin, recorded by the session that shipped it
rather than found by review: Thread's home page counts approvals and unpaid
invoices from the 200 most recent enrolments, because that is where the
endpoint caps. On a large workspace it renders a confident number that is
quietly incomplete. It is documented in the file header and every count links
through to the page holding the full truth — a mitigation, not a defence. A
count is the most confident thing a screen can say.

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

Every signed-in app and the portal have the shared bottom tab bar + "More" sheet
(`ui/bottom-nav`); dialogs render as sheets below `sm`. Builders (Flow
canvas, timeline editor) are deliberately desktop-first.

### Common tasks → where to look

| Task | Start here |
|---|---|
| Rename an app / change a domain | `packages/shared/src/branding.ts` (+ env, Vercel domains, §9). Slugs NEVER change. |
| Add a cross-app link | `crossAppHref` from `@thefibre/shared/sso-hop` |
| Add an API route | `apps/api/src/routes/*.ts`, mount in `server.ts`; auth posture in `middleware/app-context.ts` |
| New table / column | `./scripts/new-migration.sh <name>`; enable RLS and write the policy in the same file; ask "which app justifies this field?"; `docs/data-model.md` |
| Land a change on staging | `docs/runway.md`, then `./scripts/release.sh` (§10.0) |
| Deploy the API | `./scripts/deploy-api.sh staging\|prod` (§9) |
| A read whose EMPTY answer means something | `rows()` / `row()` / `count()` from `apps/api/src/lib/rows.ts`, never `data ?? []` (§11.3c) |
| Colours, spacing, recurring looks | `docs/brand-design.md`; tokens and recipes in shared |
| Money event | `purchase` ledger + `lib/fees.ts` + the relevant `*-payment-link.ts` / webhook |
| Email | `apps/api/src/lib/email/*-templates.ts`; sender/branding from `branding.ts`; locale via `platformEmailLocale` |
| New UI surface | `packages/shared/src/ui` first (§5 rule) |
| Website embed | `packages/shared/src/embed-loader.ts` + the app's `/embed.js` route + its Settings embed-code generator |
| Plans/gating | `apps/api/src/lib/plan.ts`, `/admin/plans`, `forgetAllPlans()` |
| Env/domain audit | `node scripts/verify-vercel-env.mjs` |

---

## 13. Document map

There are about a hundred files in `docs/`. Most are the record of a
decision, written before the thing was built, and are NOT maintained
afterwards. Read them for why; never for how the system behaves today. The
classes below say which is which; a superseded document carries a banner at
its top saying so.

**Living — describes the system as it is, and is kept that way**

| Document | Role |
|---|---|
| `docs/technical-overview.md` | The outward-facing summary: what it is, the stack, the size, how it is run, what is fragile. Start here if you are evaluating the system |
| `docs/system-handbook.md` | This file: the orientation for somebody about to change the code |
| `docs/data-model.md` | Every table by owner, with the relationships a newcomer must know |
| `docs/runway.md` | How a change lands and deploys: clearance, the controller, the escape hatches |
| `docs/deploy.md` / `docs/environments.md` | The API and web deploy runbooks; the two stacks, their env vars and the gotchas that were paid for |
| `docs/testing-approach.md` | How we test, the measured counts, and the principles each incident added |
| `docs/data-protection-approach.md` | How data is protected: controls and where they live, the incident record, the gap roadmap, the incident runbook |
| `docs/brand-design.md` | The binding UI rulebook: tokens, recipes, shared components |
| `docs/build-plan.md` | **The** Open queue (to-do), groomed every ship. Its header and older sections are historical; the Open queue is live |
| `CHANGELOG.md` | The shipped record, narrative per release |
| `CLAUDE.md` | Working notes every LLM session loads: hard rules, the multi-session protocol, the gotcha index |
| `docs/business-models.md`, `docs/mcp.md`, `docs/assistant-in-app.md`, `docs/zoom-marketplace-submission.md`, `docs/connections-asks.md` | Deep dives that are current: the Models app, the MCP package, the in-app assistant, the Zoom review packet, and what the owner asked of Connect and what happened to it |

**Reference — a contract, a decision or a setup guide that still holds**

| Document | Role |
|---|---|
| `docs/fibre-technical-brief-v0.4.md` | The canonical vision and data-model intent. Its domains and app names are from May 2026 |
| `docs/building-on-the-fibre.md` | The app contract — everything an in-family or external app must obey |
| `docs/brief-thread-public-api.md` | The scope of Thread's three public read routes |
| `docs/naming-brief.md`, `docs/brief-workspace-urls.md` | The branding pivot and the public URL grammar |
| `docs/spike-circle-sso.md` | The Fibre as OAuth2 provider for Circle |
| `docs/using-your-own-assistant.md` | The end-user manual for connecting a personal assistant |
| `docs/my-portal-setup.md`, `docs/platform-billing-setup.md` (steps 1 to 5), `docs/setup-google-oauth.md` | Setup guides; the first is the template for adding a Vercel project |
| `docs/cross-app-entity-mapping.md` (from "What actually shipped" down) | How external apps link their records to platform people |

**Decided proposals — built; the doc explains why, and may describe an
earlier shape**

`invoices-and-roles-proposal.md` (ledger and roles), `pricing-proposal.md`
and `productisation-proposal.md` (tiers), `membership-proposal.md`,
`fibre-pulse-proposal.md`, `i18n-proposal.md`,
`teams-as-access-groups-proposal.md`, `thread-rebuild-plan.md`,
`visitor-portal-proposal.md` and `member-portal-plan.md`,
`personal-todo-proposal.md`, `people-in-two-capacities-proposal.md`,
`brief-external-apps.md`, `brief-workspace-threads.md`,
`mcp-personal-access-plan.md`, `thethread-website-rewrite-plan.md`,
`onboarding-proposal.md`, `meet-pricing-roadmap.md`.

**Open proposals — not built**

`spaces-proposal.md` (parked), `flow-as-a-building-block-proposal.md`,
`google-workspace-provisioning.md` (only suspend and unsuspend exist).

**Historical — a record of a day, a session or a superseded design**

The `stress-test-*.md`, `launch-test-*.md`, `overnight-*.md`, `handover-*.md`
and `session-summary-*.md` records; the `connections-*.md` design set other
than `connections-asks.md`; the August `brief-*.md` series from the festival
planner integration; `fibre-technical-brief-v0.3.md`; the `fibreflow-*.md`
founding documents; `component-inventory.md`; `thread-split-map.md`;
`cutover-suite-to-meet.md`; `meet-vs-suite-parity.md`.

**Superseded — each now opens with a banner pointing at what replaced it**

`meet-architecture.md`, `meet-api.md`, `meet-data-model.md`,
`fibreflow-data-model.md`, `scale-issues.md`, `fibre-vs-app-data.md`,
`permission-tiers-proposal.md`, `platform-billing-roadmap.md`,
`ci-template/README.md`.

## 14. The hard rules (memorise these)

1. **No personal data in Vercel** — every PII operation goes through the EU API.
2. **`X-App-ID` on every API request** (user sessions).
3. **RLS on every table**; workspace + app-membership scoping.
4. **Soft delete only** for personal data; **activity is append-only** —
   type and subject only, corrections are new rows.
5. **Cursor pagination only.** (CLAUDE.md also lists "connection pooling from
   day one"; today the API reaches Postgres only through the Supabase client
   over HTTP and holds no database connections of its own, so there is
   nothing to pool. It becomes a rule again the day a direct driver is
   added.)
6. **`/api/v1/apps/*` and the Thread public reads are additive-only published contracts.**
7. **Never hand-write a domain/origin/app list** — derive from the branding
   registry (`APP_IDS`/`appUrl`) or the `app` catalogue.
8. **Slugs never change**; display names and domains are `branding.ts` + env.
9. **The app justifies the field** — no orphan data on the platform.
10. **Stripe is rails, the ledger is the record.**
11. **Shared components first; never fork a per-app UI variant.**
12. **Explicit-path staging; one landing at a time, by runway clearance;
    CHANGELOG + build-plan groomed in the same commit.**
13. **Production moves only on the owner's word** — `promote.sh` and
    `deploy-api.sh prod` are cleared with his own sentence, which the runway
    log records.
14. **A service-role query filters `workspace_id` itself**, and a route that
    takes ids from the request proves they belong to the caller's workspace
    before it acts on them (§2).
