# Brief — workspace-scoped threads

_Written 2026-09-05, from Sjoerd's question on the New-thread screen: "why is
workspace not available (only personal and team)?" Design only — nothing here
is built._

## 1. Why

The New-thread scope picker (`apps/thread/app/(app)/threads/new/form.tsx`)
offers **Personal** and **Team**. Ownership today is two columns on
`thread_thread`: `organiser_id` (always the creator's `thread_organiser` row)
and a nullable `team_id`. Personal = `team_id is null`; team = `team_id` set.
There is no way to say "this thread belongs to the workspace itself".

The use case is real: a **Year agenda** — the organisation's own programme of
events for the year. It is not Sjoerd's thread (he might leave, and his
storefront page should show *his* work, not the org calendar). It is not a
team's thread (there is no "everyone" team, and team threads carry membership
semantics — "members see and share it"). It is the workspace's. Enrolment
money for such threads should also land with the workspace, not route through
one person's vendor cut.

The plumbing half-expects this already: `GET /public/embed/threads` takes
`?workspace=<id>` and lists every public thread in a workspace. What is
missing is a thread that is *owned* at that level, and a public URL for it.

## 2. Options for the public URL

Public URLs are the constraint. `thread.thefibre.app/<ownerSlug>/<threadSlug>`
is a **published contract** (docs/brief-thread-public-api.md): the API routes
`/public/organiser/:slug` and `/public/organiser/:slug/thread/:threadSlug`
resolve `:slug` through `resolvePublicOwner()` — organiser first, then team,
one flat namespace — and every organiser-scoped query must add
`.is('team_id', null)` (the CLAUDE.md gotcha). Whatever we pick must be
additive against that contract.

**A. A workspace-level organiser row.** Extend `thread_organiser` with
`kind ∈ user | workspace` (user_id nullable, one workspace-kind row per
workspace), auto-created on first use with `slug = workspace.slug` — the same
move as the default-organiser precedent (docs/brief-thread-default-organiser.md).
Workspace threads are ordinary rows: `organiser_id` = the workspace organiser,
`team_id` null.
*For:* zero new public routes — the existing `:slug` resolver just learns a
third thing a slug can be, which is additive in the truest sense. `ownerSlugOf`,
the `.is('team_id', null)` filters, embeds, URL builders all work unchanged.
Money routing falls out: the workspace organiser row carries
`vendor_cut_percent = 0`, so revenue flows to `thread_settings.stripe_account_id`
(the workspace account) by existing maths.
*Against:* `owner_kind` in the public payload grows a value (`workspace`) —
additive, but consumers switching exhaustively on it must be documented at
/developers. `thread_organiser.user_id not null unique` becomes nullable — a
row with no user, like an app-key context. The flat public namespace gains
workspace slugs; a collision with an organiser/team slug in *another*
workspace is already possible today and this neither fixes nor worsens it.

**B. A workspace namespace: `thread.thefibre.app/w/<workspace-slug>/<thread>`.**
New public routes, matching Membership's precedent
(`apps/membership/app/[workspaceSlug]` — the workspace slug is already a
public face; `workspace.slug` exists and is globally unique).
*For:* collision-free by construction; explicit; new paths are trivially
additive.
*Against:* two URL grammars on one host forever. Every public URL builder,
embed generator, `ownerSlugOf`, and the public thread pages in the Next app
branch three ways. `w` becomes a reserved root segment (the organiser-slug
shadowing bug class, thread.ts ~line 112). Heavier for no behaviour A lacks.

**C. A reserved "everyone" team per workspace.** Auto-create a hidden team all
members belong to; workspace threads are team threads on it.
*For:* no schema change at all.
*Against:* this is a magic row — the allow-list pattern v0.14.0 existed to
kill. Its slug must be reserved in every workspace; it pollutes team pickers,
member lists, and Meet (teams are shared platform tables); "members see and
share it" is false for it; and money still routes like a team thread. No.

## 3. Recommendation

**Option A.** One URL grammar, no new public routes, and the contract change
is a documented additive enum value rather than new surface. It reuses the
auto-provision pattern we already shipped for default organisers, and it makes
the money question answer itself: a workspace thread's vendor is the
workspace. Option B is the fallback if we ever *want* a distinct workspace
storefront URL shape — nothing in A forecloses it, since new paths stay
additive.

## 4. Deltas (option A)

**Schema** (one migration):
- `thread_organiser`: drop `not null`/`unique` on `user_id`; add
  `kind text not null default 'user' check (kind in ('user','workspace'))`;
  partial unique index on `(workspace_id)` where `kind = 'workspace'`; check
  that `kind = 'user'` ⇔ `user_id is not null`.
- No change to `thread_thread` — `unique (organiser_id, slug)` already scopes
  thread slugs under the workspace organiser.

**RLS:** the workspace organiser row must be readable by workspace members
(existing workspace-scoped read policy likely covers it) but writable only by
admin+ — a policy predicate on `kind = 'workspace'` requiring
`current_workspace_role() in ('admin','super_admin')`. Thread RLS is untouched:
workspace threads are ordinary workspace rows.

**API** (`apps/api/src/routes/thread.ts`):
- `POST /threads`: accept `scope: 'workspace'`; resolve-or-create the
  workspace organiser row (mirror the `/me` auto-provision, slug seeded from
  `workspace.slug`) and use it as `organiser_id`. Gate per D1. Everywhere else
  the creator still appears — add them as host in `thread_thread_organiser` so
  "who runs this" stays answerable.
- `resolvePublicOwner()`: no change needed if the workspace organiser is a
  real `thread_organiser` row — it resolves today. Add `kind` to
  `PUBLIC_ORGANISER_SELECT` output only if the page should render "by
  <workspace>" differently; that field addition is additive.
- `/public/*` payloads: document `owner_kind: 'workspace'` (or keep reporting
  `'organiser'` — see D3) at /developers; extend
  `scripts/verify-public-api.mjs` for whichever we publish.
- Web: third toggle on the New-thread scope picker (admin+ only), URL preview
  showing `thread.thefibre.app/<workspace-slug>/…`.

**Not in scope:** `organisation_id` on `thread_thread` stays what it is —
attribution/org-share, not ownership.

## 5. Decisions for Sjoerd

- **D1 — who can create workspace threads?** Recommend: admin and super_admin
  only (organisers keep personal + team). It is the org speaking publicly.
- **D2 — money routing.** Recommend: workspace organiser row fixed at
  `vendor_cut_percent = 0`, so all net revenue goes to the workspace Stripe
  account, and the Payments settings UI hides the cut for it. Alternative:
  leave it editable like any organiser.
- **D3 — what the public payload says.** Recommend: report
  `owner_kind: 'workspace'` honestly and document it as an additive value.
  Alternative: keep `'organiser'` so no consumer ever sees a new value — safer
  for the contract, but the page cannot then distinguish "by EBBF" from "by a
  person" without a second signal.
