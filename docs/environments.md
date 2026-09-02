# Environments — a staging stack beside production

_Written 2026-09-01 for the 2026-09-02 session. Sjoerd: "should we have a dev
version and a live version?" The answer we settled on: **one staging
environment, used for the three things that can actually hurt** — migrations
that touch existing data, payments (Stripe test mode lives here), and auth
changes. Everything else keeps shipping to prod at today's speed._

## The shape

Three tiers, two of which already exist:

| Tier | What it is | Data |
|---|---|---|
| **Local** | `pnpm dev` — six dev servers on localhost | whatever your local env points at |
| **Staging** (new) | full second stack: Supabase + Fly + the five Vercel apps on a staging domain | seeded (`seed-ebbf.mjs`), disposable, **Stripe test mode** |
| **Production** | thefibre.app + thefibre-api.fly.dev + Supabase `zfsyyokepyycefbxiblc` | real |

Deliberately **not** a long-lived `dev` branch: parallel Claude sessions share
one working tree and trunk made tonight's 0.22.1 collision trivial; branches
would turn every collision into a merge. Staging tracks `main` via a
fast-forward-only pointer (`git push origin main:staging`) — same commits,
earlier audience.

Also remember the "ship dark" tools prod already has: `app.status` /
`app.released_at` hide an app until flipped, and plan gates hide features.
A lot of "we need a dev environment" is covered by those.

## Phase 0 — two decisions (make these first, tomorrow)

**D1 — The staging domain.** Auth cookies are shared across `*.thefibre.app`
so the apps can single-sign-on. If staging lived at
`staging.thefibre.app`, prod and staging would read each other's cookies
(same parent domain) — sessions bleeding between real and test data.
**Recommendation: a separate cheap apex, e.g. `thefibre.dev`** (€10/yr):
`thefibre.dev`, `meet.thefibre.dev`, `thread.thefibre.dev`,
`flow.thefibre.dev`, `pulse.thefibre.dev`. Clean cookie isolation, same
subdomain shape as prod. (The staging API needs no custom domain —
`thefibre-api-staging.fly.dev`, mirroring how prod ran on `fly.dev` for
months.)

**D2 — Supabase tier for staging.** Free tier is fine to start (pauses after
a week idle — first request of the day is slow, acceptable for staging).
Upgrade to Pro (€25/mo) only if the pause annoys us.

## Phase 1 — Claude's prep — ✅ DONE 2026-09-02 morning

- [x] **`fly.staging.toml`** — checked in (scale-to-zero: staging skips the
      email hook, so cold starts are harmless; the access-token hook is a
      Postgres function, no API round-trip).
- [x] **Domain audit** — app URLs were already env-driven
      (`NEXT_PUBLIC_FIBRE_URL` / `_MEET_URL` / `_THREAD_URL` / `_FLOW_URL` /
      `_PULSE_URL`, `NEXT_PUBLIC_API_BASE_URL`, `CORS_ORIGINS`). The
      stragglers — booking-link host displays in Meet (slug prefixes,
      team/meeting-type lists, profile "Public URL"), one Pulse invite hint —
      now derive from `appUrl(...)` via `apps/meet/lib/public-host.ts`, so
      staging shows staging URLs.
- [x] **`scripts/smoke-staging.mjs`** — health, catalogue (4 plans, Free
      first), 401 enforcement, landing/pricing/sign-in render. Gate the
      promote on it.
- [x] **`scripts/db-push-staging.sh` / `db-push-prod.sh`** — the staging
      wrapper links, pushes, and ALWAYS restores the prod link (trap on
      exit); staging's project ref lives in `supabase/.staging-ref` (commit
      it once known).

## Phase 2 — Sjoerd's steps, by the hand (~45 min of clicking)

### A · Supabase — the staging database (~10 min)

1. https://supabase.com/dashboard → **New project**. Org: same as prod.
   Name **thefibre-staging**. Region **West EU (Ireland)** (same as prod —
   migrations behave identically). Generate a DB password, save it in your
   password manager.
2. When it's ready, note from **Project Settings → API**:
   - Project ref (the `abcdefgh…` in the URL) → tell Claude
   - `URL` (https://<ref>.supabase.co)
   - `anon` key and `service_role` key
3. **Auth → Providers → Google**: enable; paste the SAME
   `GOOGLE_CLIENT_ID` + secret as prod (they're in your password manager /
   prod Supabase dashboard).
4. **Auth → URL Configuration**:
   - Site URL: `https://thefibre.dev` (or whatever D1 chose)
   - Redirect URLs: add `https://thefibre.dev/auth/callback` and
     `http://localhost:3000/auth/callback`
5. ⚠️ **Auth → Hooks → "Customize Access Token (JWT) Claims"** → enable,
   pick `public.custom_access_token_hook`. **Do this AFTER Claude has pushed
   the migrations (Phase 3 step 1) — the function doesn't exist until then.**
   This is THE classic gotcha: without it, RLS denies everything and every
   page looks broken while sign-in "works".
6. Skip the Send-Email hook for now — staging uses Supabase's default auth
   emails. (Wire it later if we ever need to test our branded emails here.)

### B · Google Cloud — one redirect URI (~2 min)

1. https://console.cloud.google.com → APIs & Services → Credentials → the
   existing Fibre OAuth client.
2. Add authorized redirect URI:
   `https://<staging-ref>.supabase.co/auth/v1/callback`
3. Save. (Same client as prod — Google doesn't care how many URIs it has.)

### C · Fly — the staging API (~5 min, terminal)

```bash
fly apps create thefibre-api-staging
```

Then the secrets — same names as prod, staging values
(`docs/deploy.md` lists what each is):

```bash
fly secrets set -a thefibre-api-staging \
  NEXT_PUBLIC_SUPABASE_URL="https://<staging-ref>.supabase.co" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="<staging anon key>" \
  SUPABASE_SERVICE_ROLE_KEY="<staging service_role key>" \
  SSO_INTERNAL_SECRET="<generate: openssl rand -hex 32>" \
  GOOGLE_CLIENT_ID="<same as prod>" \
  GOOGLE_CLIENT_SECRET="<same as prod>" \
  CORS_ORIGINS="https://thefibre.dev,https://meet.thefibre.dev,https://thread.thefibre.dev,https://flow.thefibre.dev,https://pulse.thefibre.dev"
```

Leave `RESEND_API_KEY` **unset** on purpose: the email client no-ops and
logs instead of sending — staging can never accidentally email a real
person. Leave the Stripe secrets for step F.

### D · The domain (~5 min)

1. Buy `thefibre.dev` (or D1's choice) at your registrar.
2. That's it for now — the DNS records come from Vercel in step E (it shows
   you the exact A/CNAME values when you add each domain).

### E · Vercel — five projects, staging env (~15 min, repetitive)

For **each** of the five projects (web, meet, thread, flow, pulse):

1. **Settings → Environment Variables** — add these, scoped to
   **Preview** and (important) limited to the **`staging` branch** where the
   UI offers it:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://thefibre-api-staging.fly.dev`
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` = staging
     values
   - `SSO_INTERNAL_SECRET` = the one you generated in step C
   - The five URL overrides, staging values:
     `NEXT_PUBLIC_FIBRE_URL=https://thefibre.dev`,
     `NEXT_PUBLIC_MEET_URL=https://meet.thefibre.dev`,
     `NEXT_PUBLIC_THREAD_URL=…`, `NEXT_PUBLIC_FLOW_URL=…`,
     `NEXT_PUBLIC_PULSE_URL=…`
2. **Settings → Domains** — add the project's staging domain
   (`thefibre.dev` for web, `meet.thefibre.dev` for meet, …) and assign it
   to the **`staging` branch** (Vercel asks; pick branch, type `staging`).
   Add the DNS records Vercel shows you at the registrar.

### F · Stripe — test mode (~10 min)

1. Stripe dashboard → toggle **Test mode** (top right).
2. **Developers → API keys** → copy the test `sk_test_…`.
3. **Developers → Webhooks → Add endpoint** twice, in test mode:
   - `https://thefibre-api-staging.fly.dev/api/v1/thread/stripe-webhook`
     (checkout.session.completed, checkout.session.expired)
   - `https://thefibre-api-staging.fly.dev/api/v1/billing/stripe-webhook`
     (checkout.session.completed, customer.subscription.updated,
     customer.subscription.deleted, invoice.paid, invoice.payment_failed)
   Copy each signing secret.
4. ```bash
   fly secrets set -a thefibre-api-staging \
     STRIPE_SECRET_KEY="sk_test_…" \
     STRIPE_THREAD_WEBHOOK_SECRET="whsec_…" \
     STRIPE_BILLING_WEBHOOK_SECRET="whsec_…"
   ```
5. (While you're in Stripe anyway: the **live-mode** twin of this — live
   key + both live webhooks on `thefibre-api.fly.dev` — is the standing
   item that unblocks real payments. Same clicks, live toggle.)

## Phase 3 — first light (together, ~20 min)

1. **Migrations**: write the staging project ref into
   `supabase/.staging-ref`, then run `scripts/db-push-staging.sh` → all ~80
   migrations apply to staging and the CLI link is restored to prod
   automatically (trap on exit — a bare `supabase db push` afterwards still
   means prod). ⚠️ Then Sjoerd does step A5 (enable the access-token hook).
2. **Deploy the API**: `fly deploy -c fly.staging.toml --remote-only`.
   Check `https://thefibre-api-staging.fly.dev/health`.
3. **Deploy the apps**: `git push origin main:staging` → five Vercel
   staging builds on the staging domains.
4. **Seed**: Claude runs `seed-ebbf.mjs` + `grant-super-admin.mjs` against
   staging env (both scripts read env; we'll pass staging values).
5. **Smoke checklist** (Claude drives, Sjoerd watches):
   - [ ] `/health` ok, `/api/v1/public/plans` returns 4 plans
   - [ ] Sign in with Google at `thefibre.dev` → dashboard, contacts render
   - [ ] Hop to `meet.thefibre.dev` — still signed in (cookie SSO works)
   - [ ] Open a Thread public page, enrol with a test email
   - [ ] Run `sync-stripe-plans.mjs` against staging (test mode) →
         Settings → Plan shows upgrade buttons
   - [ ] **Buy Pro with card `4242 4242 4242 4242`** → webhook fires →
         plan flips to Pro → invoice appears in Invoices → /admin/economics
         MRR shows €49
   - [ ] `verify-external-app.mjs` + `verify-public-api.mjs` pass against
         staging

## Phase 4 — the rhythm afterwards

**Normal changes (UI, copy, docs, additive migrations):** straight to prod,
exactly like today. Speed is a feature.

**The three risky classes — staging first, always:**
1. migrations that ALTER/UPDATE existing data,
2. anything touching money (Stripe, fees, the purchase ledger),
3. anything touching auth/SSO/RLS helpers.

The promote flow (same commit, two pushes):

```bash
git push origin main:staging   # staging builds; fly deploy -c fly.staging.toml if API changed
# … smoke it (scripts/smoke-staging.mjs + eyeballs) …
git push origin main           # Vercel prod
fly deploy --remote-only       # prod API, if it changed
```

**Costs:** domain ~€10/yr · Fly staging ~€0–5/mo (scale-to-zero) · Supabase
free · Vercel included · Stripe test mode free. **Total ≈ €5/mo.**

## Gotchas (so tomorrow-us doesn't rediscover them)

- The access-token hook (A5) must be enabled AFTER migrations, and it's a
  dashboard toggle — no migration can do it. Symptom of forgetting: signed
  in but everything 401s/empty.
- `supabase link` is global on this machine — always re-link to prod after
  staging work (the wrapper scripts handle it).
- Staging Vercel env vars must be scoped to the `staging` branch, or every
  PR preview will point at the staging DB too (that's actually desirable —
  previews get safe data — but know that it's happening).
- Never put a live Stripe key on staging or a test key on prod; the webhook
  secrets are mode-specific too.
- Free-tier Supabase pauses when idle — the first staging request of a day
  can take ~30s. That's the €0 trade.
- Migration filenames: 14-digit timestamps, and check
  `supabase migration list` for same-day collisions (bitten twice on
  2026-09-01).
