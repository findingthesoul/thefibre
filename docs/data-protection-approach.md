# Data security and protection approach

**Status: adopted 2026-09-14.** How The Fibre protects the data it holds —
from attackers, from mistakes, and in the sense the GDPR means. Written for
the same reader as `docs/testing-approach.md`: a programmer (likely
LLM-assisted) changing the system, and Sjoerd deciding where the next hour
of security effort goes. Everything in §3 exists and has a path; everything
in §5 does not yet, in the order it should.

**The one-paragraph version.** The database is the enforcement layer: every
table carries row-level security, every privileged function is closed to
the public role by default, and the API is a thin gate in front of it that
checks who is calling and as which app. Personal data lives in one place, in
the EU, behind that gate; the web apps are stateless and hold nothing. Every
credential the system mints is hashed, short-lived or single-use. And the
rules are enforced by tests that fail, because the two incidents this
document records were both caused by careful people following a rule that
was written down and did not hold.

---

## 1. What we protect, and from whom

**The assets**, in the order an attacker would want them:

1. **Contact graphs.** Who knows whom, in which workspace, with notes,
   readings and relationship strength. This is the product and the most
   sensitive thing we hold; a leak is a breach under Article 33.
2. **Identity.** Emails, names, sign-in identities, session tokens; the link
   between a person and the accounts they hold across apps.
3. **Money paths.** Stripe accounts and webhooks, the purchase ledger,
   invoices, VAT identities. Not card data — Stripe holds that.
4. **Tenancy.** Which workspace a user acts in, stamped into the token. The
   line every RLS policy trusts.
5. **The platform's own keys.** The service-role key, the SSO secret, the
   Stripe keys, the OAuth client secrets, the app keys of external apps.

**The threats we plan for**, each with the control that answers it:

| Who | What they try | What stops them |
|---|---|---|
| Anyone on the internet | Read another workspace's rows through the anon key that ships in every bundle | RLS with no anon policy on any PII table; every SECURITY DEFINER function closed to anon (§3.4); the RLS-floor integration test |
| Anyone on the internet | Hammer a public POST: guess a coupon, flood sign-ups, enumerate accounts | The public-POST brake (§3.3); Supabase's own OTP send limits; sign-up requests reviewed, never auto-provisioned |
| A signed-in user | Reach a person in another workspace, or a curator field of an app they are not in | RLS keyed on the token's workspace and `app_membership`; the RLS matrix test; the API never elevates to service role on a user's behalf except where a handler filters `workspace_id` itself |
| An external app with a key | Call routes its scopes do not cover, or another app's routes | Default-deny route allow-list in `middleware/app-context.ts`; scopes bound to the manifest; `:slug` must equal the key's own app; suspension kills keys at once |
| A stolen session or key | Keep working after theft | Access tokens are short-lived JWTs; handoff codes are 60 s, single use; app keys are sha256 at rest and revocable; Supabase JWT secret rotation invalidates every session (§7) |
| A malicious website | Frame a signed-in page, or read a published route with the visitor's cookies | `frame-ancestors 'self'` everywhere except the embed routes (§3.2); CORS credentials only for our own origins; public-read CORS on exactly three paths |
| A malicious input | Rewrite a database filter, inject markup, upload an executable | Quoted PostgREST filters (§3.3); DOMPurify on rich text and SVG; upload size and MIME allowlist |
| A compromised dependency | Ship code we did not write | Lockfile, weekly Dependabot with advisories immediately (§3.6); no `postinstall` scripts of our own |
| A careless author (us) | Open a function, forget RLS on a new table, log an email | The guard tests and the release gates (§6); this document |
| A lost laptop | Expose `.env` files with the service-role key | Gitignored, never in a bundle; rotation runbook (§7); the open item to move local secrets into a manager |

What we do **not** defend against and say so: a compromised Supabase, Fly or
Vercel (our sub-processors, listed in the privacy policy); a compromised
Google account of a workspace admin (their MFA, not ours — until §5 P1);
nation-state attackers; and denial of service at a scale beyond Fly's edge.

---

## 2. Principles

1. **The database is the enforcement layer; the API is convenience.** A
   check that exists only in a route handler is a check an app key, a
   script or a future route can walk around. RLS and function privileges
   are where "may" is decided (brief §13, handbook §4).
2. **Born closed.** A new table has RLS in the same migration. A new
   function has no grant to PUBLIC or anon (default privileges since
   `20260914171000`). A new route is authenticated unless it is on the
   public list with a reason. A new secret lives on Fly, never in
   `NEXT_PUBLIC_*`.
3. **No personal data in Vercel** (hard rule 1). The web apps are stateless
   renderers; every PII read and write crosses to the EU API. This is what
   makes the region story true and the blast radius of a frontend bug small.
4. **The app justifies the field** (brief §6). Data we do not hold cannot
   leak. Minimisation is the cheapest control there is.
5. **Every credential is hashed, short-lived or single-use.** App keys:
   sha256 at rest, shown once. Handoff codes: 60 seconds, one redemption.
   OAuth codes: 60 seconds. Access tokens: 15 minutes for the OAuth
   provider, Supabase's default for sessions. Webhooks: signature-checked.
6. **A rule is a guard only when it is a test.** `revoke … from public` was
   the documented pattern for months and closed nothing. The rule now lives
   in `definer-functions.int.test.ts`, which fails by name.
7. **Logs are not a data store.** An email address in a log line is a copy
   of personal data with no retention, no access control and no export
   path. Log the id; look the person up.
8. **Say what we do not do.** The gap list in §5 is part of the approach.
   A control we imagine we have is worse than one we know we lack.

---

## 3. The layers, as they exist today

Ordered from the outside in. Each item names where it lives; the intent is
that a reader can go and look, and that the next author can find the place
to extend rather than the place to fork.

### 3.1 Transport and edge

- HTTPS everywhere: `fly.toml` forces it on the API; Vercel on the apps.
- **HSTS, nosniff, referrer policy, permissions policy, framing** — since
  v0.75.0, one list in `packages/shared/src/security-headers.ts`, applied
  by every `next.config.mjs` and by the API (`hono/secure-headers` in
  `server.ts`). Signed-in pages send `frame-ancestors 'self'`; the embed
  routes (`/embed/*` in Thread and Membership) deliberately do not — they
  exist to be framed by an organiser's own website.
- **CORS** (`apps/api/src/server.ts`): a default-deny allowlist derived from
  the app registry plus localhost and Vercel previews; credentials only for
  those. The three published Thread read routes are `origin: *` without
  credentials, and nothing else under `/public/` is.
- Regions: database and auth in Ireland, API in Frankfurt, Vercel in
  Frankfurt and stateless (`docs/deploy.md`).

### 3.2 Sessions and sign-in

- Supabase Auth: Google OAuth or email OTP. The **custom access token
  hook** stamps `app_user_id` and the active workspace into every token,
  case-insensitively (`20260907190000`); it is executable by
  `supabase_auth_admin` only.
- Session cookies are domain-scoped per apex (`NEXT_PUBLIC_COOKIE_DOMAIN`)
  and carried by `@supabase/ssr`. *Gap: `httpOnly`, `secure`, `sameSite` are
  the library's defaults, not ours — §5 P1.*
- **The cross-apex hop** (`routes/sso.ts`, `sso_handoff`): a 60-second,
  single-use code redeemed server-to-server behind `X-SSO-Secret`, with the
  redemption written as an atomic conditional update so two redemptions
  cannot both succeed (`sso-race.int.test.ts`).
- The `/my` portal signs participants in by 8-digit code; the API verifies
  their token against Supabase's JWKS and reads only the email claim.
- **The Fibre as OAuth2 provider** (`routes/oauth-provider.ts`): sha256
  client secrets compared in constant time, redirect-URI allowlist,
  60-second single-use codes, 15-minute tokens, membership re-checked on
  every `/me`.
- Auth emails go through our own HMAC-verified hook (`routes/auth-hook.ts`).

### 3.3 The API gate

- **Who and as what**: every request carries a JWT (or an app key) and an
  `X-App-ID` validated against the live app catalogue
  (`middleware/app-context.ts`). Public paths are an explicit, method-
  restricted set with a reason beside each entry.
- **App keys**: 256-bit, sha256 at rest, shown once, compared in constant
  time (`lib/app-keys.ts`); a key reaches only the routes in
  `APP_KEY_ROUTES`, only with the scopes its manifest asked for, only for
  its own app; suspension revokes at once (`verify-external-app.mjs`
  step 8). *An app-key request has no user and RLS does not scope it; each
  handler filters `workspace_id` itself — the one place the "database
  enforces" principle is carried by the handler. Reviewed on every touch
  of `/api/v1/apps/*`; a lint for it is §5 P1.* An AI assistant connected
  over MCP (`packages/mcp`, since v0.76.0) is one more holder of an app key:
  it reaches the same `APP_KEY_ROUTES`, filtered to the key's scopes, and
  carries no other credential — a test reads the route table from source
  and fails on any tool outside it (`docs/mcp.md` §1).
- **Archived workspaces** are read-only except billing, profile, privacy
  and sign-out (`archivedGate`).
- **Input**: zod on the routes that take bodies (178 schemas); rich text
  through DOMPurify on the way in (`lib/rich-text.ts`); uploads capped at
  5 MB, six image types, SVG sanitised; **PostgREST filters never carry a
  raw value** — the contact searches use `orIlike()`
  (`lib/postgrest-filter.ts`), quoted per the grammar and proven against
  staging (`postgrest-filter.int.test.ts`). Found and fixed 2026-09-14: both
  searches had interpolated the term since May.
- **Brakes** (`lib/rate-limit.ts`, applied in `server.ts`): the three
  published read routes are metered per IP for foreign origins; since
  v0.75.0 every public POST family (enrol, book, sign-up request, coupon
  check, portal code, OAuth token, app registration) is metered per IP at
  120/minute. In-memory, per machine — an abuse brake, not a security
  control; the honest version keys on the target and is §5 P1.
- **The in-app assistant** (`/api/v1/assistant`, since v0.77.0,
  `docs/assistant-in-app.md`): the one route that sends workspace content to
  a model provider. User sessions only; per-user brake (40 turns / 10 min);
  every tool runs as the user through this API's own routes; what reaches the
  model is an allow-list built field by field — titles, dates, statuses,
  counts — with participant names, emails, answers, notes and the activity
  log excluded by construction and by test. *Switched off until
  `ANTHROPIC_API_KEY` exists; the sub-processor entry, DPA and region
  decision are open (§6 of that doc) and gate production.*

### 3.4 The database

- **RLS on every table** (hard rule 3): 206 policies over 190 migrations,
  all `to authenticated`; the one anon policy inserts a pending sign-up
  request and nothing else. Service-role-only tables (`sso_handoff`,
  `user_connection`, `oauth_*`, `user_active_workspace`) have RLS on and no
  policies at all.
- **Tenancy from the token**: `current_workspace_id()` and
  `current_user_id()` read JWT claims; `is_workspace_admin()`,
  `can_see_person()` and friends decide visibility as the signed-in role.
- **Definer functions born closed** (handbook §11.3b): every SECURITY
  DEFINER function is executable by `service_role` and, for the nine
  reviewed RLS helpers, by `authenticated`; by nobody else. The default
  privileges make the next one the same. The allowlist in
  `apps/api/scripts/lib/definer-probe.mjs` is the review record; the
  integration test and `audit-definer-functions.mjs` are the guard.
- **Append-only where it matters**: `activity` (the data wall — type and
  subject, never a body), `purchase` corrections as new rows, the
  `person_merge` audit with a reversing `unmerge_person`.
- **Super admins cannot be deleted or demoted to zero** by anyone,
  including a super admin (`protect_super_admin` trigger).
- Soft delete only for personal data (hard rule 4).

### 3.5 Money

- Four Stripe webhooks, each signature-verified against its own secret
  before a byte is trusted; connected-account mode for the three that
  receive money on organisers' accounts. `verify-stripe-webhooks.mjs`
  audits registration; `register-stripe-webhooks.mjs` makes it so and pushes
  the signing secrets to Fly without printing them.
- Idempotency on the natural keys (`request_id`, `stripe_session_id`); the
  purchase ledger is update-first-insert-second. *A generic replay guard on
  inbound events is §5 P1.*
- Card data never touches us: Stripe Checkout, always.

### 3.6 Secrets and supply chain

- Fly secrets for the API (`docs/deploy.md`), Vercel env for the apps;
  `.env*` gitignored and verified absent from history; the only
  `NEXT_PUBLIC_*` values are URLs, the anon key and the cookie domain.
- `SSO_INTERNAL_SECRET` gates every server-to-server call between apps and
  the API and signs the OAuth provider's tokens; `openssl rand -hex 32`.
- Lockfile-pinned installs; **Dependabot weekly, advisories immediately**
  (`.github/dependabot.yml`, since v0.75.0). CI typechecks, tests and builds
  on every push. *No SAST, no `pnpm audit` gate yet — §5 P2.*

### 3.7 Rights of the data subject

- **Consent**: `consent_record` with purpose and legal basis, IP recorded,
  revocable (`routes/privacy.ts`); `has_active_consent()` gates the cohort
  directory and marketing.
- **Access (Art. 15)**: `GET /privacy/export` assembles everything held
  about the caller across sixteen categories with a manifest of what was
  included.
- **Erasure (Art. 17)**: files a `data_subject_request` for a person to
  handle. *Automation is §5 P2; the append-only tables mean erasure is
  anonymisation, not deletion, and that needs a design.*
- **Retention**: Free workspaces archive after 13 months' inactivity
  (`retention_months`, `usage-meters.ts`); paid ones do not expire. *The
  `retention_policy` table exists and nothing reads it — §5 P2.*
- **Where the data is**, who the sub-processors are, and what a person may
  ask for: `packages/shared/src/ui/legal-docs.tsx` (the privacy policy,
  unreviewed by a lawyer).

---

## 4. What the record says

Two incidents, both closed, both instructive because the authors had
followed a written rule.

- **2026-09-13 — three identity functions callable by the anon key.**
  `resolve_sso_identity`, `ensure_workspace_member`, `ensure_user_person`
  had been "locked" with `revoke … from public`, which on Supabase leaves
  the separate grants to `anon` and `authenticated` in place. Anyone could
  attach an external identity to an account whose email they knew, or add
  any user to any workspace. Found by a sweep, fixed the same night
  (`20260913071000`–`073000`), no evidence of exploitation.
- **2026-09-14 — nine RLS helpers callable by the anon key.** Nil exposure
  (they answer only about the caller) but the same open door. Revoking
  from anon closed five; four had never been locked and still carried the
  implicit grant to PUBLIC. Fixed by `20260914170000`/`171000`, which also
  changed the default so the next function is born closed, and by the
  standing guard test.
- **2026-09-14 — two PostgREST filter injections** in the contact searches,
  present since May, bounded by RLS. Fixed by `orIlike()`.
- **2026-09-14 — three PostgREST filter injections**, not two: the purchases
  search had the same shape and was found by the Meet session in review.
  Fixed on `orIlike()` and a new `orEq()`, both proven against staging.
- **2026-09-15 — production's Thread and Meet webhooks in the wrong mode.**
  The webhook verifier had read `connect`, a field Stripe never returns, so
  for a week every endpoint reported as platform-mode and the report was
  ignored as noise. Corrected to read the Connect application id, the audit
  run on production with a one-off restricted read key showed Membership and
  Billing right and Thread and Meet wrong: a paid Thread enrolment or Meet
  booking would have stayed pending after the customer paid, since those
  charges land on connected accounts. Recreated in connected-account mode by
  `register-stripe-webhooks.mjs --live`, signing secrets pushed to Fly in the
  same run, verified all green. Both restricted keys deleted afterwards; one
  had been echoed to a terminal, which is why the runbook now says `read -s`.

The lesson each time was the same: **a rule that is not a failing test is a
hope**. The guard tests in §3 exist because of these three.

---

## 5. Known gaps and the roadmap

Groomed like everything else, via `docs/build-plan.md`. Priority is by
blast radius over cost.

**P0 — landed with this document (v0.75.0):** security headers on every
surface; the filter injection; the public-POST brake; Dependabot.

**P1 — before the first paid enterprise workspace:**

1. **Content-Security-Policy**, report-only first, then enforced. Nine apps,
   a theme script, Stripe, Google — real work, real blast radius.
2. **Cookie flags stated, not inherited**: `httpOnly`, `secure`,
   `sameSite=lax` set explicitly in the shared Supabase server client.
3. **MFA for super admins** — Supabase supports TOTP; the `/admin/*` routes
   require an `aal2` claim.
4. **Log redaction**: a `log()` helper that never prints an email or a name
   (`routes/sso.ts:66` and `lib/email/client.ts:67` are the two known
   offenders); Fly log retention noted.
5. **Admin action audit**: one append-only table for `/admin/*` writes and
   role changes (who, what, when, from where). `billing_plan.features.audit_log`
   is a flag with nothing behind it.
6. **Webhook replay guard**: a `stripe_event` table keyed on the event id,
   inserted before handling, so a replayed event is a no-op by construction.
7. **App-key handler lint**: a test that every route in `APP_KEY_ROUTES`
   filters `workspace_id` explicitly, since RLS is not doing it.
8. **Brakes keyed on the target**: coupon attempts per (workspace, code),
   portal codes per email, sign-up requests per email — the IP-keyed brake
   is blind to Vercel's shared egress and to a distributed loop.
9. **Upload sniffing**: magic bytes, not the client's `file.type`; the
   assets bucket is public by design, so what goes in must be an image.
10. **Backup and restore, rehearsed**: Supabase keeps daily backups; nobody
    has restored one. A restore drill on staging, documented, with the
    point-in-time window stated.
11. **Key rotation runbook** (§7) exercised once on staging.
12. **Local secrets** out of `.env` files and into a manager on developer
    machines; the classifier already refuses to mint sessions for Sjoerd's
    account from an ad-hoc script, which is the right instinct.

**P2 — as the platform grows:**

- SAST and `pnpm audit` in CI (CodeQL is free for the repo's tier).
- An external penetration test, scoped to the API gate and the multi-tenant
  boundary, before the first enterprise contract.
- Erasure automation: anonymise the person row, keep the append-only rows
  pointing at a tombstone; a design, then a job.
- A retention job that reads `retention_policy`.
- Access review cadence: who holds Supabase, Fly, Vercel, Stripe and
  GitHub access, quarterly, written down.
- Data-processing agreements with the beta workspaces; the sub-processor
  list already in the privacy policy, reviewed by a lawyer.

---

## 6. Security gates, per change

Added to the release checklist in `docs/testing-approach.md` §5, not a
separate ritual:

- **A new table** → RLS enabled and its policies in the same migration;
  `rls-floor.int.test.ts` gets the table if it holds PII.
- **A new SECURITY DEFINER function** → born closed; if row policies call
  it, `grant execute … to authenticated` and add it to
  `AUTHENTICATED_ALLOWED` with the reason; the guard test names it
  otherwise.
- **A new public route** → on the explicit list with its reason and method,
  zod on its body, covered by the POST brake if it is a POST.
- **A new PostgREST filter with a value** → `orIlike()` or a typed query,
  never a template string; `postgrest-filter.int.test.ts` proves the
  grammar.
- **A new secret** → Fly or Vercel env, never `NEXT_PUBLIC_*`, named in
  `docs/deploy.md`.
- **A new app** → inherits the headers, CORS, the switcher and the brakes
  from the shared package the day it exists; nothing to add.
- **Any auth or money change** → staging rehearsal, then watch the Fly log
  during the first production exercise (testing approach §5).

---

## 7. When something goes wrong

The short runbook, until the incident has taught us a longer one.

1. **Detect.** Fly logs (`fly logs -a thefibre-api`), Supabase Auth logs,
   the Stripe dashboard's webhook delivery page, the nightly contract job,
   a person telling us. Silence is not success.
2. **Contain.** Depending on what leaked:
   - an app key → delete the `app_key` row; the key dies at once;
   - a Fibre user's session → Supabase → Auth → sign the user out;
   - the anon key or JWT secret → rotate the JWT secret in Supabase, which
     invalidates every session on the platform, then redeploy;
   - `SSO_INTERNAL_SECRET` → `openssl rand -hex 32`, set on Fly and on every
     Vercel project, redeploy all. **Since v0.78.0 this secret also derives
     the key that encrypts workspace-supplied assistant keys**
     (`workspace_assistant`, lib/assistant/secret.ts): rotating it makes every
     stored assistant key unreadable, so tell the workspaces that set one to
     enter it again, or re-encrypt under the new secret before the old one
     is gone;
   - the service-role key → rotate in Supabase, update Fly and
     `apps/api/.env*` on every machine;
   - a Stripe key or webhook secret → roll in the Stripe dashboard;
     `register-stripe-webhooks.mjs` recreates endpoints and pushes secrets.
3. **Assess.** Which rows, which workspaces, which people; RLS and the
   append-only tables usually make the "which" answerable from the data.
4. **Notify.** Personal data breach: the Autoriteit Persoonsgegevens within
   72 hours (Art. 33), the affected people without undue delay if the risk
   to them is high (Art. 34), the affected workspace admins in every case.
5. **Record.** `docs/incidents/<date>-<slug>.md`: what, when, how found,
   what was done, what changed so it cannot recur. §4 above is the seed.

---

## 8. How to check, right now

```bash
# every SECURITY DEFINER function, as anon (and as a session with FIBRE_BEARER)
node apps/api/scripts/audit-definer-functions.mjs                 # production
FIBRE_ENV_FILE=.env.staging node apps/api/scripts/audit-definer-functions.mjs

# the anon floor, the RLS matrix, tenancy, the definer guard, filter grammar
pnpm test:integration

# webhooks registered the way the code expects
FIBRE_ENV_FILE=.env.staging node apps/api/scripts/verify-stripe-webhooks.mjs

# the published contract: shapes, CORS on exactly three paths, metering
FIBRE_API=https://thefibre-api.fly.dev node apps/api/scripts/verify-public-api.mjs

# the headers a surface actually sends
curl -sI https://thefibre.app | grep -iE "strict-transport|x-content|referrer|frame|permissions"
```
