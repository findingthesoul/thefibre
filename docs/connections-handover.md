# Connections — state at 2026-09-12 01:15

*End of the build session. Everything is released; nothing sits on a branch.
The reasoning behind the design lives in the other `connections-*.md`
documents, indexed by [`connections-overview.md`](connections-overview.md).*

---

## 1. Do these three, in this order

Connections is built, released and on GitHub. It does not serve yet, and
**every remaining step is a Vercel or secrets action, not code.**

**1. Fix the build settings** on the `thefibre-connections` project.
`connections.thethread.app` returns 404 because no build has succeeded. Two
failures so far, and the second looked like a new problem while being the
same one:

- **Root Directory → `apps/connections`.** At the repo root, Vercel reads the
  root `vercel.json`, whose `outputDirectory` is `apps/web/.next` — so the app
  builds correctly and then fails looking for web's output.
- **Build, Install and Output overrides → all blank.** `apps/connections/vercel.json`
  configures them. A dashboard override left from the first attempt survives
  the Root Directory fix and causes a *second* failure after the build
  succeeds.
- Framework Preset → Next.js.

Domains are already attached correctly: `connections.thefibre.tech` → the
`staging` branch, `connections.thethread.app` → Production.

**2. Set the environment variables.** Production scope:

```
NEXT_PUBLIC_SUPABASE_URL=https://zfsyyokepyycefbxiblc.supabase.co
NEXT_PUBLIC_API_BASE_URL=https://thefibre-api.fly.dev
NEXT_PUBLIC_COOKIE_DOMAIN=.thethread.app
```

Preview scope, git branch `staging`: the same three pointed at
`lukhyylwhhjyihqtghvw.supabase.co`, `thefibre-api-staging.fly.dev` and
`.thefibre.tech`, plus the eight `NEXT_PUBLIC_*_URL` values listed in the
staging matrix of `scripts/verify-vercel-env.mjs`.

Both scopes also need `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SSO_INTERNAL_SECRET`, **copied from the Pulse project** — the SSO value must
match what Fly holds or the cross-app sign-in hop breaks.

`node scripts/verify-vercel-env.mjs <token-file> <prod-anon> <staging-anon> apply`
does all of it except `SSO_INTERNAL_SECRET`, which it refuses to invent.

**3. Then, and only then, flip `available: true`** for `fibre-sales` in
`packages/shared/src/branding.ts`.

It ships **false** on purpose. The flag means "you can go there": it gates
every app switcher, the Fibre dashboard, the SSO hop target check, and —
because that list is derived rather than written out — `scripts/smoke-prod.mjs`.
Setting it true before the domain served failed the release gate on
`connections.thethread.app`, which is the gate working. So Connections being
absent from switchers right now is deliberate, not a bug.

Once it is true, every *other* app's staging Vercel project needs
`NEXT_PUBLIC_CONNECTIONS_URL` too, or their switchers cannot link to it. The
audit script will name the ones missing it.

---

## 2. What is live

**v0.70.0 — the person SPoT.** `apps/api/src/lib/resolve-person.ts` is the
only way a person is matched or created; nine call sites across six route
files go through it. `person.created_via` records how each row arrived.
Reversible merge: `merge_person()`, `unmerge_person()`,
`person_duplicate_candidates()` (pg_trgm), `person_and_merged()`. Four
admin-gated routes under `/persons`.

**v0.70.2 — the duplicate review screen** at `/contacts/duplicates` in Fibre
web, plus a guard in `release.sh` that refuses to push unless
`origin/staging` is an ancestor of `HEAD`. *(That release's CHANGELOG says the
screen had never been rendered signed in. True when written; closed shortly
after — verified against staging with a planted session: both detection
rules, the provenance line, a real merge, and undo. The entry was left as
written rather than retro-corrected.)*

**v0.71.0 — Connections**, the eighth app. Owns no data: two read-only SQL
functions and nothing else. `connections_landscape(workspace, as_of)` places
everyone on a ladder derived from activity, enrolments, purchases, membership
and who runs threads. `connections_attention(workspace)` gives four named
conditions, each carrying the fact behind it, never a score.

**v0.72.1 — the Vercel recipe** in `docs/deploy.md`, `thefibre-connections`
added to the audit script's hand-kept project list, brand letters fixed.

Prod and staging schemas are level. Both APIs are deployed.

---

## 3. Not in git

Connections is **activated on staging** for workspace `ca0569d5…` (the
rehearsal workspace): `app.status = 'approved'` for `fibre-sales`, a
`workspace_app` row, an `app_membership` for sjoerd@soul.com. Without these
the app redirects to `/no-access`, which is correct behaviour rather than a
bug. Production has none of it; activating there is a deliberate act.

Fixture people seeded during verification were removed by id. One merge was
performed and undone.

---

## 4. The one open question

**Which rungs are real?** The ladder is *holds space / contributes / came back
/ came once / in touch / not yet* — my guess, not a decision. It sits
underneath every view in the series, so a wrong ladder makes everything above
it subtly wrong. This is the thing to answer before building further on it.

Next in the build order after that is `flow_note`: widening `flow_run_note` so
a conversation note can hang off a person or an organisation, with
`happened_at`, `origin` and `client_ref` from the first migration. Nothing of
it is started.

---

## 5. Two things that cost real time

- **A fresh worktree has no gitignored env files.** `pnpm verify` needs
  `apps/api/.env`, the integration suite needs `apps/api/.env.staging`, a dev
  server needs `apps/*/.env.local`. Copy them in, and **delete them before any
  deploy** — they never show in `git status`, so the tree can look clean while
  secrets sit in the build context. The `**/.env` fix in v0.70.1 closes the
  hazard; the habit is still worth keeping.
- **Signing in locally against staging.** The magic-link `redirect_to` is not
  allowlisted for localhost, and `generateLink` returns a fragment the
  server-side PKCE callback cannot read. What works, proven twice: `verifyOtp`
  server-side for a session, then write it into the browser as the
  `sb-<ref>-auth-token` cookie — base64-prefixed JSON, chunked at 3180 chars.
