# Setting up my.thethread.app — TransIP + Vercel

**For:** Sjoerd
**Date:** 2026-09-08
**Companion to:** [`visitor-portal-proposal.md`](visitor-portal-proposal.md)

---

## Read this first: the order matters

There is nothing to point a domain at yet. `apps/my` does not exist in the
repo — `apps/` holds api, flow, meet, membership, pulse, thread, web, website.

So the sequence is:

1. **I build `apps/my`** (with its `vercel.json`, in the shape every sibling
   app uses) and push it.
2. **You create the Vercel project** — it needs the folder to exist.
3. **You add the DNS records** — Vercel tells you the exact values, and it can
   only verify a domain once a project claims it.

Doing 2 and 3 first means creating a project that builds nothing and a record
that resolves to a 404. If you'd rather have the accounts ready in advance,
step 2 can be done as soon as the folder is pushed; step 3 genuinely needs
step 2 first.

What is **already done**, so you don't redo it: the `my-portal` entry in the
`SURFACES` registry, the API's CORS accepting `https://my.thethread.app` on
prod and staging, `localhost:3007` in the dev origins, `thefibre-my` in the
Vercel preview regex, and the API route itself (`GET /api/v1/me/portal`,
live on both Fly APIs).

---

## Step 2 — Vercel

### Create the project

1. Vercel dashboard → **Add New… → Project**.
2. Import the **`findingthesoul/thefibre`** repo (the same repo as the other
   seven projects — Vercel allows many projects from one repo).
3. **Project Name:** `thefibre-my`

   This name is not cosmetic. `apps/api/src/server.ts` already allows preview
   deploys matching `thefibre-my-<hash>.vercel.app` through CORS. A different
   name means preview deploys can't call the API.
4. **Root Directory:** `apps/my` — click *Edit* beside Root Directory and pick
   the folder. Leave "Include files outside the root directory" **enabled**
   (it's a monorepo; the build reaches `packages/shared`).
5. **Framework Preset:** Next.js. Leave Build/Install commands alone — they
   come from `apps/my/vercel.json`, which I'll commit alongside the app:

   ```json
   {
     "framework": "nextjs",
     "buildCommand": "cd ../.. && pnpm --filter @thefibre/my... build",
     "installCommand": "cd ../.. && pnpm install",
     "ignoreCommand": "node ../../scripts/vercel-ignore.mjs my",
     "regions": ["fra1"]
   }
   ```

   (The trailing `...` in the filter means "and its workspace dependencies" —
   it builds `packages/shared` first. `fra1` keeps it in the EU, like every
   other project.)
6. **Don't deploy yet** — set the environment variables first, or the first
   build ships without them.

### Environment variables

Set these under **Settings → Environment Variables**. Copy the values from an
existing project (`thefibre-membership` is the closest sibling) rather than
retyping keys.

**Production** environment:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://zfsyyokepyycefbxiblc.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(copy from another project — anon key, **never** the service-role key)* |
| `NEXT_PUBLIC_API_BASE_URL` | `https://thefibre-api.fly.dev` |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | `.thethread.app` |
| `SSO_INTERNAL_SECRET` | *(copy from another project)* |

**Preview** environment (this is what staging runs on):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://lukhyylwhhjyihqtghvw.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(the **staging** anon key)* |
| `NEXT_PUBLIC_API_BASE_URL` | `https://thefibre-api-staging.fly.dev` |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | `.thefibre.tech` |
| `SSO_INTERNAL_SECRET` | *(copy from another project)* |

> The leading dot on the cookie domain is load-bearing — it's what lets the
> session span subdomains. `.thethread.app` and `.thefibre.tech` are two
> different apexes and a cookie cannot span both; that's what the `/sso/hop`
> handoff exists for.

There's a checker for this once the project exists:

```bash
node scripts/verify-vercel-env.mjs <token-file> <prod-anon-key> <staging-anon-key>
```

It currently checks seven projects; I'll add `thefibre-my` to its list when I
build the app, so it guards this one too.

### Domains

**Settings → Domains**, add both:

- `my.thethread.app` → assign to the **Production** branch (`main`)
- `my.thefibre.tech` → assign to the **`staging`** branch

Vercel will show you the exact DNS record to create for each. Use *its*
values, not mine — what follows is only what the siblings resolve to today,
so you can sanity-check that Vercel is telling you something sensible.

---

## Step 3 — TransIP

Two zones, one record each.

### `thethread.app` zone (production)

TransIP control panel → **Domains → thethread.app → DNS**.

| Field | Value |
|---|---|
| Name | `my` |
| Type | `A` |
| TTL | 300 (or leave the default) |
| Value | `76.76.21.21` |

`76.76.21.21` is Vercel's anycast address and is what `app.thethread.app` and
`membership.thethread.app` both resolve to today. If Vercel's Domains tab
shows you something different, follow Vercel.

### `thefibre.tech` zone (staging)

The staging siblings use a **CNAME** to a per-project Vercel hostname rather
than an A record — `membership.thefibre.tech` resolves via
`…vercel-dns-016.com`. That target is project-specific, so **take it from
Vercel's Domains tab**; don't copy the membership one.

| Field | Value |
|---|---|
| Name | `my` |
| Type | `CNAME` |
| TTL | 300 |
| Value | *(whatever Vercel shows for `my.thefibre.tech`)* |

### Then

Back in Vercel → Domains, both entries should flip to **Valid Configuration**
within a few minutes. DNS can take longer to propagate; if it's still amber
after ~15 minutes, re-check the record name is `my` and not `my.thethread.app`
(TransIP appends the zone itself — a full hostname in the Name field produces
`my.thethread.app.thethread.app`, which is the classic mistake here).

---

## How to know it worked

```bash
dig +short my.thethread.app A
curl -s -o /dev/null -w "%{http_code}\n" https://my.thethread.app
```

Today those give you nothing and `000`. When it's live: an IP, and `200`.

---

## What is NOT on this list

- **Nothing to do on the API.** CORS, the route and the registry are already
  deployed on prod and staging.
- **No Stripe, no webhooks.** The portal is read-only; it takes no money.
- **No new Supabase project.** It uses the existing ones.
- **No Fly deploy.** The portal is a Next.js app on Vercel like its siblings.

## Still blocked on you elsewhere (unrelated to this setup)

The wallet passes are written and inert, waiting on an **Apple Pass Type ID
certificate** and a **Google Wallet issuer account**. They matter here because
a wallet pass beats a web page for a ticket at a door — offline by default,
and it lives where people already look. Worth doing before the PWA work (D4).
