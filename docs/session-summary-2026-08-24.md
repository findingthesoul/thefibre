# Work summary — external apps and the Flow gaps

_Sessions of 2026-08-22 → 2026-08-24. Two releases, both live: migrations
applied, API deployed to Fly, web on Vercel, all pushed._

---

## v0.14.0 — The Fibre welcomes external apps

From `docs/brief-external-apps.md`, written after a real half-failed attempt to
integrate the Festival of Trust planner from outside the monorepo. Its verdict
on "can The Fibre host external apps?" was **not yet**. This closed all of it
except the curator-data write API.

### The structural blocker

`public.app.slug` carried an allow-list constraint. Every app since phase 0 had
registered itself by dropping the constraint, inserting, and re-adding it with
its own slug appended — inside a platform migration. So **registering an app was
a schema change against the platform database**: the set of installable apps was
fixed at build time, and nobody outside the platform team could add one.

Slugs are now validated by **format**. The guard the allow-list stood in for
moved onto the row as a lifecycle — `pending → approved → suspended`, plus
`kind`, `owner_user_id` and `manifest` — reviewed at a new **Admin → App
registry** screen. Deliberately shaped after `signup_request` rather than
inventing a second review pattern. `POST /api/v1/apps/register` is public,
because an app registering itself has no credential yet.

Activation refuses anything not `approved`, enforced by a trigger so it holds
whichever client writes the row. It only fires for rows that end up *active*, so
deactivating a suspended app still works — otherwise a suspension would trap the
workspace.

### The security shape

Before this, an external app authenticated with a **user-scoped Supabase JWT
pulled from a live browser session**. That ruled out background sync, and — the
serious half — handed a third-party app the user's full platform authority in
every app, whatever its manifest asked for.

`app_key` replaces it: a credential scoped to (app × workspace). The token is
returned once at mint and only its SHA-256 is stored. Suspending the app,
deactivating it on the workspace, or revoking the key all bite on the next
request.

Scopes stopped being decorative, in two layers:

- A key can never carry a scope its manifest didn't request.
- An app key reaches an **explicit route allow-list** and nothing else — default
  deny, so widening an app's surface is a deliberate edit rather than a side
  effect of granting a scope. General `/persons` and `/organisations` stay
  unreachable: they run on a user's RLS identity, and a key has none.

### The rest

- **Organisation links** — `POST /links` was person-only, which blocked the
  planner's declared `festival_host → organisation` mapping outright. Orgs match
  on `domain`, then `name`; the required scope follows the mapping's target, not
  the URL.
- **Bulk linking** — up to 500 per call, 207 on partial success.
- **`PUT /apps/:slug/manifest`** and **`GET /apps/whoami`**.
- **Activity types validated against the manifest.** The API accepted any
  snake_case string, so a typo landed silently on an append-only timeline and
  stayed there.

**Deviation from the brief's sketch:** `app_key` has no
`unique (app_id, workspace_id)`. That would make rotation a hard cutover — you
could not mint the replacement before revoking the incumbent.

---

## v0.17.0 (Flow 1.13.0) — flow steps gain sections and app-defined fields

Gaps 3 and 4 of `docs/brief-flow-as-planner-engine.md`, the last two structural
gaps under the planner. `flow_step` had taken no new columns since it was
created; these are the ones it needed.

- **`group_key` + `group_label`** — an optional section. The planner's nine steps
  fall into three phases that drive its whole visual system, and a step had
  `ordinal`, `kind`, `canvas_x/y` and nothing to say "these three belong
  together". `group_key` is the stable one consumers group on; renaming
  `group_label` moves nothing.
- **`meta jsonb`** — app-defined fields the platform never interprets. The
  planner needs three descriptions per step (purpose, trap, reflection) where
  `flow_step` offers one. Deliberately not three columns: hard-coding one app's
  fields invites the next app's four. The brief calls it "the curator-data
  problem in miniature" and it gets the same answer — the app justifies the
  field, so the app carries it.

Both are additive on the app-key contract and asserted in the verify script
rather than only declared. `meta` returns `{}` rather than null when unset, so a
consumer needs no guard.

Both also got **a UI home in Flow's step inspector**. Settable-only-by-SQL is
the exact pattern v0.14.0 removed from the app catalogue.

### The trap worth knowing

**Saving a flow wipes and re-inserts every step.** A column not carried through
`GraphStep` → `loadGraph` → `stepRows` is destroyed the first time anyone opens
the builder and hits save. All three are wired through that round-trip, and the
migration carries a note for whoever adds the next column. For the same reason,
a step whose `meta` won't parse blocks the save rather than being dropped.

---

## Mistakes made and fixed

1. **Test data left in the real workspace.** The first verification run created
   four fake contacts and an organisation and didn't remove them — `cleanup()`
   swallowed every error, never deleted the persons or the org, and never
   deleted `app_membership`, whose FK silently blocked the app row. Cleaned up;
   the script now reports anything it cannot remove.
2. **A leak in the same script.** Every run stranded one more soft-deleted
   person, because each is pinned by its own append-only activity row and
   nothing could collect them. It reached 13 before I noticed. A re-run now
   revives exactly one dormant row. Two subtleties, both found by running it
   rather than reasoning about it: reviving *all* of them made the linker's
   `maybeSingle()` match many rows and create yet another, and doing the revive
   before the soft-delete loop meant the same pass undid it.
3. **A doc contradicting reality.** `cross-app-entity-mapping.md` still listed
   five things as unbuilt that v0.14.0 shipped.

### What can't be cleaned

13 soft-deleted `verify-organiser@example.com` rows, one activity row, and the
`verify-external-app` app row (left `suspended`). Each is pinned by an
append-only activity row, which is a platform rule I worked within rather than
around. All are invisible in the UI.

---

## Housekeeping

- `verify-external-app.mjs` now requires `FIBRE_VERIFY_CONFIRM=1`. There is one
  Supabase project, so "local" only ever described the API process — the script
  always writes to the real workspace and should not be runnable by accident.
- The git remote was HTTPS, which needs a token GitHub no longer issues by
  password. The SSH key at `~/.ssh/id_ed25519` was already authorised; the
  remote is now `git@github.com:findingthesoul/thefibre.git` and pushes need
  nothing pasted.

---

## Still open

| Item | Where |
|---|---|
| Curator-data write API — the last piece of the external-apps brief | build-plan 9a |
| The communities/organisations variation — needs a design call first | planner brief gap 5 |
| The Thread has no app-key surface | planner brief |
| First-party apps declare no `activity_types`, so they keep the permissive path | build-plan 9c |
