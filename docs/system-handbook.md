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
docs/             briefs, proposals, runbooks (§13 doc map)
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
| `i18n.ts`, `ui/i18n-ui.tsx`, `chrome-server-i18n.ts` | Six locales (en, nl, es, pt, de, fr), **typed catalogs** — a missing translation is a type error. `// MT` marks machine drafts. |
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
4. **`/auth/me` is a published shape too, in practice.** Eight apps read it,
   so a local need answered there is a wide contract widened for one screen.
   Answer a situational question — may this user edit, does this workspace
   have X — on the endpoint that already owns it and that the screen is
   already calling. Connections' band-label endpoint returns `can_edit` for
   exactly this reason; Thread's dashboard takes a name and an email from
   `/me` and nothing else.

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
`thread_organiser`'s `site_name` / `site_headline` / `site_intro` are plain
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
  that app, `packages/shared`, or the lockfile changed. It saved ~€150 in
  five days and it has two sharp edges:
  - **Env-var-only changes rebuild nothing.** `NEXT_PUBLIC_*` values are
    inlined at BUILD time, so setting them changes nothing until a build
    runs. **"Redeploy manually" does not work** — the ignore step runs on
    dashboard and API-created deployments too, and cancels them the same
    way (measured 2026-09-09 on `thefibre-my`). The only fix is a commit
    that touches the app's folder, `packages/shared` or the lockfile.
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
- **Fly**: `fly deploy --remote-only` (prod) /
  `fly deploy -c fly.staging.toml --remote-only`. Secrets via
  `fly secrets set` (use `--stage` to defer to the next deploy). Fly
  machine leases block force-destroys for ~15 min after a half-completed
  deploy — wait it out.
- **Smoke**: `scripts/smoke-staging.mjs` asserts every subdomain serves its
  own app by `<title>`, deriving subdomains from the web apex env — reuse
  the pattern for any domain work.
- The old `*.thefibre.app` app subdomains are GONE (hard cut executed
  2026-09-07: detached from Vercel, transitional `CORS_ORIGINS` removed).
  Old Thread V3 decommission + TransIP record cleanup remain in
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
- **After every ship** (standing authorization): push ONLY via
  `./scripts/release.sh <version>` (guard → version consistency across every
  workspace package — DERIVED from `apps/*/package.json` + root +
  `packages/shared` since v0.68.20, never hand-listed, so an eighth app is
  covered the moment it exists →
  no staged leftovers → `pnpm verify` → push **`staging` only** — one
  `set -e` script, born 2026-09-08 after a broken `&&` chain pushed past a
  guard refusal). Then `bash scripts/db-push-staging.sh` if migrations.
  Vercel deploys itself from the push. When debugging, first verify
  deployed == committed.

  **Production is promoted, not released** (2026-09-12). `release.sh` used to
  push `main` and `staging` together, so every release built every changed app
  TWICE. Measured over the fourteen days to that date: **2374 builds and 1268
  build-minutes** across nine Vercel projects, against a bill Sjoerd put at
  about €300. Halving the branches halves that, and it finally buys what the
  two-stack setup was for — look at it on `.tech`, then ship.

  So: `./scripts/release.sh <version>` lands on staging. Look at it. Then
  `./scripts/promote.sh` fast-forwards main to whatever staging has, printing
  the range and warning if it carries migrations that are not on production
  yet. Fast-forward only: if main has commits staging does not, something
  reached production outside this flow and merging it here would be guesswork
  about whose work survives. `scripts/release-guard.sh` now reads the last
  released number from `origin/staging` for the same reason — main lags by
  design, and a guard reading a lagging ref would approve a number another
  session already used.

  `db-push-prod.sh` and `fly deploy` belong with the PROMOTION, not with the
  release — migrations first, then the code that needs them.

  **Track `origin/staging`.** This is the one new habit and it bites
  immediately: main lags by design, so the reflex pull leaves a session
  without the last release and release.sh's ancestor check refuses. Caught by
  the Thread session reviewing this change, rather than by the first person to
  hit it in the morning. Merge staging fast-forward before starting and again
  before bumping a version; the refusal message now says so instead of the old
  advice to reconcile, which was right under the previous flow and wrong under
  this one.
  **Docs-only exception** (agreed between sessions, 2026-09-08): a commit
  touching ONLY `docs/**` / `*.md` — no code, no version surfaces — may
  push directly (`git push origin main main:staging`) with a `docs:`
  message prefix; there is no version to mislabel, which is the failure
  the script prevents. Anything touching code or version surfaces goes
  through the script, no exceptions.
- **Multiple concurrent LLM sessions are normal** in this repo — and
  increasingly the default way Sjoerd works. The operative checklist lives
  in `CLAUDE.md` under **"Parallel SESSIONS — the serialization protocol"**,
  because that file loads into every session automatically and this one does
  not. (Until 2026-09-09 this bullet pointed at CLAUDE.md for a protocol
  CLAUDE.md did not contain — it documented parallel *subagents* only, and a
  session duly reinvented the protocol from scratch.) The rules, in short:
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
- **Verification is part of the release** — the full testing approach is
  §11; the per-release gate checklist is §11.4.

---

## 11. Testing

Full rationale and roadmap: `docs/testing-approach.md`. This section is the
operational summary.

**Honest baseline:** no unit-test files, no test runner (deliberate
early-stage trade). Today's safety net = the type system + executable
contract checks + a full staging twin + disciplined manual loops. The
guiding rule: **test the promises, not the plumbing** — contracts
(published APIs, money, sign-in, RLS tenancy) get tests; UI plumbing gets
types and render checks.

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
3. **Unit tests** (planned — Vitest): pure money/tenancy logic only —
   `lib/fees.ts`, VAT, `lib/plan.ts` gating, `sso-hop.ts` sanitisation.
4. **Integration tests** (planned): API routes against the staging DB with
   a fixture workspace — the RLS matrix (workspace A must never read B;
   app-key default deny), webhook idempotency, the handoff single-use race.
   Real Postgres always — mocking the DB tests nothing, RLS is the point.
5. **E2E smoke** (planned — Playwright on staging): ~10 golden paths (OTP
   sign-in, dashboard, app switch incl. cross-apex hop, public thread page,
   test-ticket enrolment through Stripe test checkout, /my, embed resize).
   Kept ruthlessly small so it stays green and trusted.
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

### 11.4 Release gates (run per release)

0. `./scripts/release-guard.sh <intended-version>` — refuses a release
   number that does not beat origin/main's newest CHANGELOG heading
   (or a stale local). Born 2026-09-07 after three same-number
   collisions between concurrent sessions: **history is the
   serialization truth; announcements are courtesy.**
1. `pnpm -r typecheck` — always.
2. The verify script for any touched contract area (`/api/v1/apps/*` →
   verify-external-app; Thread public/CORS → verify-public-api;
   env/domains → verify-vercel-env + smoke).
3. Shell/layout change → signed-in render check.
4. Money/auth change → staging rehearsal with test keys, then watch the
   API log during the first prod exercise.
5. Migrations → applied to **both** DBs in the same ship.
6. After deploy: prod smoke + read the Fly log.

The multi-session serialization protocol (§10) is part of testing: one
release at a time and explicit-path staging keep other sessions'
half-finished work out of the tested artifact.

### 11.5 Adoption state

Phase 0 is DONE (v0.53.0: `pnpm verify` = typecheck → `pnpm -r test` →
scripts/smoke-prod.mjs → verify-public-api) and Phase 2 has STARTED
(vitest in shared+api; 30 unit tests on sso-hop, branding, i18n,
pricing + money extractions v0.54.0). Phase 1 is DONE (CI installed
2026-09-07 — the token blocker was a phantom, SSH pushes carry no
workflow-scope restriction; ci.yml = typecheck + tests + builds per push,
nightly-contracts.yml = daily prod+staging smoke). Phase 3 STARTED
v0.55.0 (`pnpm test:integration` vs staging: RLS anon-floor, purchase
idempotency, handoff race). Phase 4 STARTED v0.56.0 (`pnpm test:e2e`:
6 Playwright golden paths incl. a signed-in dashboard via a minted
/sso/land code). Remaining pieces sequenced in `docs/testing-approach.md`
§4 and tracked in build-plan 0a. Cost profile: tooling €0, CI ≈ free tier, the real cost is
session time (front-loaded) plus ~2–5 min of gates per release.

---

## 12. Working on this codebase

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

## 13. Document map

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
| `docs/testing-approach.md` | How we test: internal/external testing, the layer stack, release gates, adoption roadmap |
| `CLAUDE.md` | LLM session working notes: hard rules, gotcha index, current state |

## 14. The hard rules (memorise these)

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
