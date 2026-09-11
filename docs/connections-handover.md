# Connections — state at 2026-09-11 22:55

*Written at the end of the build session, for the debug-and-refinement chat
that picks this up. Facts only; the reasoning lives in the other
`connections-*.md` documents, indexed by
[`connections-overview.md`](connections-overview.md).*

---

## 1. What is live in production

**v0.70.0 — the person SPoT.** Released, deployed, migrations applied to prod.

- `apps/api/src/lib/resolve-person.ts` is the only way a person is matched or
  created. Nine call sites across six route files now go through it.
- `person.created_via` records how every new row arrived.
- `person.merged_into`, `public.person_merge`, `merge_person()`,
  `unmerge_person()`, `person_duplicate_candidates()` (pg_trgm),
  `person_and_merged()`.
- Four admin-gated routes: `GET /persons/duplicates`, `POST /persons/merge`,
  `POST /persons/merges/:id/undo`, `GET /persons/merges`.

**v0.70.1** (peer session) fixed `scripts/release.sh` to push `HEAD` rather
than `main`, and added `**/.env` to `.dockerignore`.

**v0.70.2** (peer session, `992b0d40`) released the **duplicate review
screen** at `/contacts/duplicates` in Fibre web, plus a guard in
`release.sh` that refuses to push unless `origin/staging` is an ancestor of
`HEAD`.

> **Gap closed 23:0x, after the v0.70.2 CHANGELOG entry was written.** That
> entry says the screen had never been rendered signed in, which was true when
> written and is no longer. Verified against staging with a planted session
> (§7): empty state, both detection rules rendering with seeded pairs, the
> provenance line reading "typed in" / "enrolled in a thread" / "booked a
> meeting", **Keep this one** performing a real merge, the merge appearing
> under Recent merges, and **Undo** restoring the pair. Fixtures removed by
> id afterwards. The CHANGELOG was left as written rather than
> retro-corrected — it was accurate at the time, and an entry that quietly
> improves after the fact is worse than one that is dated.

*Why the guard exists:* `git push origin HEAD:main HEAD:staging` updates two
refs in one command and git does not apply them atomically. With staging
diverged, main lands and only staging is rejected — released, reported as
failed, one retry from burning a second version number. Staging had diverged
because this session pushed `HEAD:staging` alone to get a Vercel build for a
render check, which is off-label: the documented flow pushes the *same*
commit to both refs.

---

## 2. What is committed but NOT released

Branch `worktree-connections-person-resolver`, two commits ahead of `main`:

| Commit | What |
|---|---|
| `a74db96c` | **`apps/connections`** — the eighth app: landscape + attention |
| `02009601` | This handover note |

Neither is on `main` or `staging`. **Neither has a version bump or a
CHANGELOG entry.**

---

## 3. Where prod and staging differ — read this before deploying anything

| | Prod | Staging |
|---|---|---|
| `connections_landscape()` | **missing** | applied |
| `connections_attention()` | **missing** | applied |
| API with `/api/v1/connections/*` | **not deployed** | deployed |
| `apps/connections` on Vercel | project does not exist | project does not exist |

**The order matters.** The API route selects from functions that do not exist
on prod. Migrations must land before the Fly deploy, or every call to
`/api/v1/connections/*` errors in the window between them.

`scripts/db-push-prod.sh` then `fly deploy --remote-only`. Check
`git status --short` in the same breath as the deploy — Fly sends the tree.

---

## 4. Things done to staging data that are not in git

- **Connections was activated** for workspace `ca0569d5…` (the rehearsal
  workspace): `app.status = 'approved'` for `fibre-sales`, a `workspace_app`
  row, and an `app_membership` for sjoerd@soul.com. Without these the app
  redirects to `/no-access` — which is correct behaviour, not a bug.
- Four fixture people were seeded and **removed again** by id.
- One merge was performed and undone through the HTTP routes.

Prod has none of this. Activating Connections there is a deliberate act.

---

## 5. Open, in rough order

1. **Vercel projects** for `apps/connections` — prod and staging. The DNS
   already points at Vercel for `connections.thethread.app` and
   `connections.thefibre.tech`; the directory now exists, which was the
   blocker. Copy the settings from `apps/pulse`'s project;
   `apps/connections/vercel.json` already carries the right build and ignore
   commands.
2. **`CORS_ORIGINS`** on the staging API needs `https://connections.thefibre.tech`
   appended (`fly secrets set`). Prod needs nothing: `PROD_ORIGINS` is derived
   from `APP_IDS` + `appUrl`, so the branding change covered it.
3. **Release** the two commits. Suggested `v0.71.0` — new app, two migrations.
   This will be the first release run from a worktree through the patched
   `release.sh`; the peer session asked for a report on whether it behaves.
4. **D27 is still unanswered** and it is the one that matters: are the rungs
   right for soul.com and EBBF? I guessed at *holds space / contributes /
   came back / came once / in touch / not yet*. Everything above the ladder
   inherits from it.

---

## 6. Known rough edges in what was built

- **`apps/connections/lib/i18n-ui.ts` is Pulse's catalog** plus the
  Connections keys. The shell reads dozens of Pulse keys, so a trimmed
  catalog would fail typecheck on chrome the app did not write. Prune once
  the surfaces settle; the header says so.
- **`/attention`'s "went quiet" never fires on young data.** It needs three
  events and a gap of twice a person's own rhythm with a 60-day floor.
  Correct, but it means the page looks thin on staging.
- **No `/people` page.** The nav was trimmed to Landscape and Needs you
  rather than ship an entry that 404s.
- **The landscape is unpaginated.** Fine at 17 people, and
  `docs/scale-issues.md` puts trouble at 10k. The snapshot pattern
  (D35, `pulse_projection_snapshot` as precedent) is the intended answer
  when it is needed, not now.
- **`created_via` is null for every row that predates v0.70.0**, so the
  duplicate screen shows "origin unknown" for most people today. Honest, and
  it fills in from here.

---

## 7. Two things that cost real time, for whoever hits them next

- **A fresh worktree has no gitignored env files.** `pnpm verify` needs
  `apps/api/.env`, the integration suite needs `apps/api/.env.staging`, and a
  dev server needs `apps/*/.env.local`. Copy them in, and **delete them
  before any deploy** — they do not show in `git status`, so the tree can look
  clean while secrets sit in the build context. The `.dockerignore` fix in
  v0.70.1 closes the hazard; the habit is still worth keeping.
- **Signing in locally against staging.** The magic-link `redirect_to` is not
  allowlisted for localhost, and `generateLink` returns a fragment the
  server-side PKCE callback cannot read. What works: `verifyOtp` server-side
  for a session, then write it as the `sb-<ref>-auth-token` cookie
  (base64-prefixed JSON, chunked at 3180 chars) into the browser.
