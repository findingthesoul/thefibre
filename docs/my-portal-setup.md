# Setting up my.thethread.app — TransIP + Vercel

**For:** Sjoerd
**Date:** 2026-09-08
**Companion to:** [`visitor-portal-proposal.md`](visitor-portal-proposal.md)

---

## Status (checked 2026-09-09): the Vercel project still does not exist

`apps/my` shipped in **v0.68.20** and is on `main`. The Vercel Root Directory
list reads from the repo, so `my` now appears between `meet`/`membership` and
`pulse`. If you had the import dialog open before that, close and reopen it —
the list is fetched once.

What the outside world says today:

- `dig +short my.thethread.app A` → `76.76.21.21`. The production DNS record
  **is already there** — step 3 got done ahead of step 2.
- `curl https://my.thethread.app` → TLS handshake failure. No certificate,
  because no Vercel project has claimed the hostname yet.
- `https://thefibre-my.vercel.app` → `404` with `x-vercel-error:
  DEPLOYMENT_NOT_FOUND`. That is Vercel saying the project isn't there.
- `my.thefibre.tech` **now resolves** — `CNAME 5966874a0d5c85ce.vercel-dns-016.com`,
  created mid-morning on 2026-09-09, after an earlier check that hour found
  nothing. HTTPS on it still fails, same missing certificate, same cause.

Remaining order:

1. ~~Build `apps/my`~~ **done (v0.68.20)**. Verified 2026-09-09: `pnpm
   --filter @thefibre/my... build` is clean and the sign-in page renders on
   `localhost:3007`.
2. **Create the Vercel project** — below. This is the only thing standing
   between the app and a live URL.
3. **Add the DNS records** — already done, both zones. Production has its A
   record and staging has its CNAME.

So DNS is no longer part of the critical path at all. Everything now waits on
step 2, and only step 2. **DNS does not have to follow the project**, which
an earlier draft of this doc implied: `my.thefibre.tech` resolves today with
no Vercel project behind it. What a project supplies is the certificate.

> **In the Root Directory dialog, do not pick `api`.** It's first in the list
> and the radio may default to it. The API runs on Fly, not Vercel, and hard
> rule §1 is that no personal data goes to Vercel. Pick `my`.

What is **already done**, so you don't redo it: the `my-portal` entry in the
`SURFACES` registry, the production API's CORS accepting
`https://my.thethread.app` (verified — the deployed prod API reflects that
origin back), `localhost:3007` in the dev origins, `thefibre-my` in the Vercel
preview regex, and the API route itself (`GET /api/v1/me/portal`, live on
both Fly APIs — it answers `401 sign in required`, which is the route
existing).

> **RESOLVED 2026-09-09** — the secret has been set and verified: the staging
> API now reflects both `https://my.thefibre.tech` and
> `https://membership.thefibre.tech` back. The rest of this note is kept as
> the record of what was wrong and why. **The live value already contained
> `membership.thefibre.tech`** before the change, so this added exactly one
> origin; `docs/environments.md`'s setup example lists only five and is the
> thing that makes it look otherwise — don't rebuild the value from that
> example, read the live one with
> `fly ssh console -a thefibre-api-staging -C "printenv CORS_ORIGINS"`.
>
> **What was wrong.** The
> staging API did **not** allow `https://my.thefibre.tech`. Its
> `CORS_ORIGINS` secret lists the six older subdomains and stops there, so
> the staging portal will be CORS-blocked the moment it loads. Prod is
> derived from the `SURFACES` registry and needs nothing; staging is a
> hand-written env var and needs this, before the staging domain is useful:
>
> ```bash
> fly secrets set CORS_ORIGINS="https://thefibre.tech,https://meet.thefibre.tech,https://thread.thefibre.tech,https://flow.thefibre.tech,https://pulse.thefibre.tech,https://membership.thefibre.tech,https://my.thefibre.tech" -a thefibre-api-staging
> ```
>
> This is the fourth instance of the "new app forgotten in a hand-written
> list" bug the derived allowlist was meant to end. The staging half is still
> hand-written, so it keeps happening.

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
   **`my`** (not `api`). Leave "Include files outside the root directory" **enabled**
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

`thefibre-my` is already in its list (added in v0.68.20), along with
`NEXT_PUBLIC_MY_URL` for staging — so it guards this project too.

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

The staging siblings use a **CNAME** rather than an A record. The target is
**account-scoped, not project-specific** — measured 2026-09-09, all six
`.tech` subdomains (meet, thread, flow, pulse, membership, my) share one
identical value:

```
5966874a0d5c85ce.vercel-dns-016.com
```

Still take it from Vercel's Domains tab rather than from here — but because
Vercel is authoritative, not because each project gets its own. The wrong
reason produced a wrong sequencing rule ("DNS must follow the project"),
which is corrected above.

**Why A records on `thethread.app` and CNAMEs on `thefibre.tech`?** Half of
it isn't a choice: DNS forbids a CNAME at a zone apex, so an apex is always
an A record. The subdomain split is generational — `76.76.21.21` is Vercel's
older shared anycast address, and the CNAME is their current style, which
lets them move you without you editing DNS.

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

As of 2026-09-09 that gives you `76.76.21.21` and `000` — DNS points at
Vercel, but nothing there answers for the name. When it's live: the same IP,
and `200`.

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
