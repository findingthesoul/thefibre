# Deploying The Fibre

Two services to deploy. Both can be done in ~15 minutes once you have the accounts set up.

## What lives where

| Component | Where | Region |
|---|---|---|
| Web (`apps/web`) | Vercel | `fra1` (Frankfurt) |
| API (`apps/api`) | Fly.io | `fra` (Frankfurt) |
| Database + Auth | Supabase | West EU (Ireland) — existing |

The web is stateless. Personal data is processed *only* by the API on Fly.io — never on Vercel (brief §13 hard rule).

---

## Web → Vercel

You already created a Vercel project named `thefibre` earlier. Fix the configuration that failed last time:

### One-time setup

1. Open the project in the [Vercel dashboard](https://vercel.com/dashboard).
2. **Settings → Build and Development Settings:**
   - **Framework Preset:** `Next.js` (the earlier 404 was because this was wrong)
   - **Root Directory:** `apps/web`  (click Edit → choose this folder)
   - **Build / Install commands:** *leave blank* — the `apps/web/vercel.json` in the repo configures these for the monorepo (`cd ../.. && pnpm --filter @thefibre/web build` / `cd ../.. && pnpm install`)
3. **Settings → Environment Variables** (add to **Production** and **Preview**):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://zfsyyokepyycefbxiblc.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (from Supabase dashboard → Settings → API)
   - `NEXT_PUBLIC_API_BASE_URL` = `https://api.thefibre.app` (or the Fly app URL until DNS is wired; e.g. `https://thefibre-api.fly.dev`)
   - `NEXT_PUBLIC_COOKIE_DOMAIN` = `.thefibre.app` — leading dot is intentional, that's what makes Supabase auth cookies valid for every `*.thefibre.app` subdomain so signing into `thefibre.app` also signs you into `meet.thefibre.app` and `thread.thefibre.app`. **Set this on EVERY app's Vercel project** (`thefibre`, `thefibre-meet`, `thefibre-thread`). Missing it on one project means users get prompted to re-login when switching subdomains.
   - `SSO_INTERNAL_SECRET` = match the value you set on Fly later (see below)
   - `DEFAULT_WORKSPACE_ID` = `eaf096f8-59f8-45d0-b3e3-3d31c8ebffeb`
4. **Deployments tab → Redeploy.**

> **First-login gotcha after enabling `NEXT_PUBLIC_COOKIE_DOMAIN`**: existing
> sessions were stored with cookies scoped to a single subdomain. Setting the
> env var doesn't retroactively re-scope them. Every existing user has to
> sign in once more after the redeploy — that new login writes the cookie
> with `domain=.thefibre.app`, and from then on cross-subdomain SSO works.
> Verify in devtools → Application → Cookies → `sb-…-auth-token` should
> show `Domain: .thefibre.app` (with the leading dot).

### Domain wiring

Once the deploy is green:

1. **Settings → Domains** → add `thefibre.app` (and `www.thefibre.app` redirecting to apex).
2. Vercel gives you DNS records to set at your registrar — typically an A record `76.76.21.21` and the standard CNAME setup. Set them.
3. After DNS propagates (minutes to an hour), Vercel issues the TLS cert automatically.
4. Update Supabase Auth allowed redirect URLs to include `https://thefibre.app/**`.

---

## API → Fly.io

### Prerequisites

- Install Fly CLI: `curl -L https://fly.io/install.sh | sh` (and add `~/.fly/bin` to PATH)
- `fly auth login`

### One-time setup (run all commands **from the repo root**)

The canonical `fly.toml` lives **at the repo root** — Fly resolves the
Dockerfile path relative to fly.toml's directory, and the monorepo
Dockerfile needs the repo root as build context.

```bash
# Create the app (Frankfurt region, no managed Postgres — we use Supabase)
fly launch \
  --name thefibre-api \
  --region fra \
  --no-deploy \
  --copy-config \
  --dockerfile apps/api/Dockerfile

# Set secrets — pulls from your local apps/api/.env
fly secrets set \
  NEXT_PUBLIC_SUPABASE_URL="https://zfsyyokepyycefbxiblc.supabase.co" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="<paste from Supabase dashboard>" \
  SUPABASE_SERVICE_ROLE_KEY="<paste from Supabase dashboard>" \
  GOOGLE_CLIENT_ID="<paste from Supabase Auth → Google provider>" \
  GOOGLE_CLIENT_SECRET="<paste from Supabase Auth → Google provider>" \
  RESEND_API_KEY="<paste from Resend dashboard>" \
  EMAIL_FROM="The Fibre <noreply@thefibre.app>" \
  SSO_INTERNAL_SECRET="$(openssl rand -hex 32)"

# First deploy
fly deploy --remote-only
```

After this the API is at `https://thefibre-api.fly.dev`. Health check: `curl https://thefibre-api.fly.dev/health` → `{"ok":true}`.

### Subsequent deploys

```bash
# from the repo root
fly deploy --remote-only
```

### Custom domain

```bash
fly certs add api.thefibre.app
# Add the CNAME record Fly gives you at your registrar
```

Then update the Vercel env var `NEXT_PUBLIC_API_BASE_URL` to `https://api.thefibre.app` and redeploy the web.

### CORS

The API uses Hono CORS with `origin: (origin) => isAllowedOrigin(origin) — allowlist, unknown origins blocked`, which allows any caller. Tighten this before opening to outside traffic: in `apps/api/src/server.ts`, restrict to the production web origins.

---

## Supabase

No deploy needed — the project is already running. Two things to keep in sync:

1. **Migrations.** Apply with `supabase db push` against the linked project. Run from any machine that has `supabase login` done and has `supabase link --project-ref zfsyyokepyycefbxiblc` set up.
2. **Auth → Redirect URLs.** Add your prod URLs once Vercel is wired:
   - `https://thefibre.app/**`
   - `https://*.thefibre.app/**`
3. **Auth → Hooks.** `Customize Access Token` must point at `public.custom_access_token_hook` — already enabled.

---

## Stripe (payments)

Two webhook endpoints must exist in the Stripe dashboard (Developers →
Webhooks), each with its own signing secret set on Fly:

| Endpoint | Events | Fly secret |
|---|---|---|
| `https://thefibre-api.fly.dev/api/v1/meet/stripe-webhook` | `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed` | `STRIPE_WEBHOOK_SECRET` |
| `https://thefibre-api.fly.dev/api/v1/thread/stripe-webhook` | `checkout.session.completed`, `checkout.session.expired` | `STRIPE_THREAD_WEBHOOK_SECRET` (falls back to `STRIPE_WEBHOOK_SECRET` if shared) |

`STRIPE_SECRET_KEY` is the platform key. Connected accounts are pasted per
person/workspace in Settings → Payments (the platform SPoT:
`user_profile.stripe_account_id` + `workspace.stripe_account_id`).

Without the Thread webhook, paid enrolments stay `pending` forever — the
invoice-method path (mark-paid) is the only one that completes.

---

## Sanity check after first deploy

1. Hit `https://thefibre.app` — should show the landing page
2. Click **Sign in with Google** — should redirect through Google, back to `/auth/callback`, then to `/dashboard`
3. The dashboard should list your apps (Fibre Meet, The Thread, Fibre Flow) — these come from the JWT's `app_memberships` claim
4. Open Contacts — you should see the 8 seeded people. Open Marja → her profile tabs render including Fibre Meet (Change context) and Fibre Learn (Learning).

If the dashboard shows "Not linked to a workspace" or you get redirected back to `/`, that's the JWT custom-access-token hook not firing. Check Supabase Auth → Hooks.

---

## Roll-back

Vercel: Deployments tab → previous deployment → "Promote to Production".
Fly: `fly releases` then `fly deploy --image <previous>`.
Supabase: every schema change is a migration file in `supabase/migrations/`. To roll back, write an inverse migration (we don't auto-roll because every shipped version is meant to be additive — see brief §13).
