# Setting up my.thethread.app — TransIP + Vercel

**For:** Sjoerd
**Date:** 2026-09-08
**Companion to:** [`visitor-portal-proposal.md`](visitor-portal-proposal.md)

---

## Status (measured 2026-09-10): production is LIVE; staging is behind Vercel SSO

`apps/my` shipped in **v0.68.20**. The `thefibre-my` project was created,
both domains were added, and the app has been serving since **v0.68.24**.
Everything from here down is the record of how it was set up, kept because
the next new app will need the same steps.

Measured this morning:

| | |
|---|---|
| `https://my.thethread.app` | `200`, titled "My Thread" |
| `https://my.thefibre.tech` | `302` to `vercel.com/sso-api` |

**The one thing still open is the staging redirect.** `thefibre-my` carries
Vercel Standard Protection (`ssoProtection: all_except_custom_domains`) where
the six product apps carry `null`, so the staging branch — which Vercel treats
as a Preview — sits behind Vercel's own sign-in. Production is unaffected.
Flipping it is a Vercel dashboard setting, yours to make.

> An earlier draft of this section said the project did not exist. It said so
> for a day after it did, and it was believed rather than measured — the
> CHANGELOG entry for v0.68.57 repeated the claim. Measure the domain.

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

## Step 4 — push something that triggers a build

**Do not assume the previous steps deployed anything.** `apps/my/vercel.json`
carries `ignoreCommand: vercel-ignore.mjs my`, which builds only when a push
touches one of three paths: `apps/my`, `packages/shared`, or the lockfile.
Everything else reports **CANCELED**. So the project, the env vars and the
domains can all be perfect and nothing is served.

That is what happened here on 2026-09-09. `my.thethread.app` answered `500`
all day from a deployment built the previous evening, before it had any env
vars — `NEXT_PUBLIC_*` is inlined at BUILD time, so setting the vars changed
nothing, and `createServerClient(undefined, undefined)` threw in a server
component.

**Redeploying from the Vercel dashboard or API does not get around it**; the
ignore step runs there too and cancels those the same way. A push touching a
trigger path is the only thing that produces a build.

Usually this resolves itself, which is exactly why the rule is easy to miss:
most releases touch `packages/shared`, and that counts. Both builds this
project has ever run were triggered by `packages/shared` — never by
`apps/my`. If you are standing up a new app and nothing is deploying, that is
the first thing to check, and any real change to one of the three paths fixes
it.

---

## How to know it worked

```bash
dig +short my.thethread.app A
curl -s -o /dev/null -w "%{http_code}\n" https://my.thethread.app
```

As of 2026-09-10 that gives you `76.76.21.21` and `200`, which is what live
looks like. `000` with the right IP is the in-between state: DNS points at
Vercel and nothing there answers for the name yet.

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
