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
   - `SSO_INTERNAL_SECRET` = match the value you set on Fly later (see below)
   - `DEFAULT_WORKSPACE_ID` = `eaf096f8-59f8-45d0-b3e3-3d31c8ebffeb`
4. **Deployments tab → Redeploy.**

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

```bash
# Create the app (Frankfurt region, no managed Postgres — we use Supabase)
fly launch \
  --name thefibre-api \
  --region fra \
  --no-deploy \
  --copy-config \
  --config apps/api/fly.toml \
  --dockerfile apps/api/Dockerfile

# Set secrets — pulls from your local apps/api/.env
fly secrets set --config apps/api/fly.toml \
  NEXT_PUBLIC_SUPABASE_URL="https://zfsyyokepyycefbxiblc.supabase.co" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="<paste from Supabase dashboard>" \
  SUPABASE_SERVICE_ROLE_KEY="<paste from Supabase dashboard>" \
  SSO_INTERNAL_SECRET="$(openssl rand -hex 32)"

# First deploy
fly deploy --config apps/api/fly.toml
```

After this the API is at `https://thefibre-api.fly.dev`. Health check: `curl https://thefibre-api.fly.dev/health` → `{"ok":true}`.

### Subsequent deploys

```bash
fly deploy --config apps/api/fly.toml
```

### Custom domain

```bash
fly certs add api.thefibre.app --config apps/api/fly.toml
# Add the CNAME record Fly gives you at your registrar
```

Then update the Vercel env var `NEXT_PUBLIC_API_BASE_URL` to `https://api.thefibre.app` and redeploy the web.

### CORS

The API uses Hono CORS with `origin: (origin) => origin ?? '*'`, which allows any caller. Tighten this before opening to outside traffic: in `apps/api/src/server.ts`, restrict to the production web origins.

---

## Supabase

No deploy needed — the project is already running. Two things to keep in sync:

1. **Migrations.** Apply with `supabase db push` against the linked project. Run from any machine that has `supabase login` done and has `supabase link --project-ref zfsyyokepyycefbxiblc` set up.
2. **Auth → Redirect URLs.** Add your prod URLs once Vercel is wired:
   - `https://thefibre.app/**`
   - `https://*.thefibre.app/**`
3. **Auth → Hooks.** `Customize Access Token` must point at `public.custom_access_token_hook` — already enabled.

---

## Sanity check after first deploy

1. Hit `https://thefibre.app` — should show the landing page
2. Click **Sign in with Google** — should redirect through Google, back to `/auth/callback`, then to `/dashboard`
3. The dashboard should list your apps (Fibre Meet, The Thread, Fibre Sales, Fibre Learn) — these come from the JWT's `app_memberships` claim
4. Open Contacts — you should see the 8 seeded people. Open Marja → her profile tabs render including Fibre Meet (Change context) and Fibre Learn (Learning).

If the dashboard shows "Not linked to a workspace" or you get redirected back to `/`, that's the JWT custom-access-token hook not firing. Check Supabase Auth → Hooks.

---

## Roll-back

Vercel: Deployments tab → previous deployment → "Promote to Production".
Fly: `fly releases --config apps/api/fly.toml` then `fly deploy --image <previous>`.
Supabase: every schema change is a migration file in `supabase/migrations/`. To roll back, write an inverse migration (we don't auto-roll because every shipped version is meant to be additive — see brief §13).
