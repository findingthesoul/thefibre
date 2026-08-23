# Brief — make The Fibre welcome external apps

_Written 2026-08-22, from a real attempt to integrate one._

> **Status: shipped in v0.14.0 (2026-08-22).** §1, §2 and §3 landed together,
> and all of §4 except the curator-data write API. The six-step verification
> below runs as `apps/api/scripts/verify-external-app.mjs` and passes.
> `docs/building-on-the-fibre.md` is the up-to-date path; this brief stays as
> the record of what was wrong and why it was changed. Two deviations from the
> sketches below are noted where they occur.

## Why this exists

The Festival of Trust planner (repo: `~/Projects/festivaloftrust.com`, live at
festivaloftrust.com) was built as the first app to integrate with The Fibre
from **outside** this monorepo. It was chosen deliberately as a test: if a
friendly app written by the same people cannot integrate cleanly, a genuinely
third-party one has no chance.

It got part way. `docs/building-on-the-fibre.md` describes the intended path and
already lists known gaps. This brief covers what the attempt actually hit, in
priority order, and what the goal state looks like.

The honest current answer to "can The Fibre host external apps?" is **not yet**.
One blocker is structural; the rest are missing pieces.

---

## 1. The structural blocker: the app catalogue is closed

`public.app.slug` carries `app_slug_check`, an allow-list:

```sql
-- supabase/migrations/20260512100000_phase0_identity_and_contact_graph.sql
slug text not null unique
  check (slug in ('fibre-suite','the-thread','fibre-sales','fibre-learn')),
```

Every app since has registered itself by dropping the constraint, inserting, and
re-adding it with its own slug appended — inside a platform migration. See
`20260520120000_fibre_flow_schema.sql` §1 and `20260707120000_fibre_pulse_schema.sql` §1.

So **registering an app is a schema migration against the platform database**,
not the INSERT the guide describes. Consequences:

- The set of installable apps is fixed at platform build time.
- Nobody outside the platform team can register one, however good the API is.
- A self-registration endpoint cannot be built on this table as it stands.

### What to change

Drop the allow-list and validate slugs by format instead:

```sql
alter table public.app drop constraint if exists app_slug_check;
alter table public.app
  add constraint app_slug_format
  check (slug ~ '^[a-z][a-z0-9-]{1,48}[a-z0-9]$');
```

Losing the allow-list means losing a guard, so replace it with the thing the
allow-list was standing in for — a lifecycle on the row itself:

```sql
alter table public.app
  add column owner_user_id uuid references public."user"(id),
  add column status text not null default 'pending'
    check (status in ('pending','approved','suspended')),
  add column kind text not null default 'third_party'
    check (kind in ('first_party','third_party')),
  add column manifest jsonb,
  add column created_at timestamptz not null default now();

-- Existing in-family apps keep their standing.
update public.app set status = 'approved', kind = 'first_party';
```

Then `workspace_app` activation should refuse anything not `approved`. That
moves the gate from "is this slug in a hardcoded list" to "has a human approved
this app" — which is the actual policy, and one that can be administered rather
than deployed.

**Note the precedent already exists**: `signup_request` has exactly this
`pending → approved` shape with an admin screen at
`apps/web/app/(app)/admin/access-requests`. App registration should mirror it
rather than invent a second pattern.

---

## 2. No server-to-server credentials

Today an external app needs "a user-scoped Supabase JWT … pulled from a
signed-in browser session". That means:

- No background sync, no scheduled jobs, no webhooks — anything the app wants to
  write requires a human with a live browser session.
- The app is handed a token that carries the **user's** full platform authority,
  not the app's. A third-party app holding a user JWT can do anything that user
  can, in every app, regardless of what its manifest asked for.

That second point is the serious one. It is not just missing convenience; it is
a privilege-escalation shape. Any external-app story needs credentials scoped to
`(workspace × app)` before it can be recommended to anyone.

Sketch:

```sql
create table public.app_key (
  id            uuid primary key default gen_random_uuid(),
  app_id        uuid not null references public.app(id) on delete cascade,
  workspace_id  uuid not null references public.workspace(id) on delete cascade,
  token_hash    text not null,          -- store the hash, never the token
  scopes        text[] not null default '{}',
  created_by    uuid not null references public."user"(id),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  unique (app_id, workspace_id)
);
```

> **Shipped without the `unique (app_id, workspace_id)`.** It would make
> rotation a hard cutover — you could not mint the replacement before revoking
> the incumbent. Several live keys per pair are allowed instead, with a partial
> index on the un-revoked ones. Everything else landed as sketched, plus
> `name`, `token_prefix` (for the UI) and `revoked_by`.

The API middleware then resolves a key to `(app, workspace, scopes)` and builds
its context from that, instead of from a user JWT.

---

## 3. Scopes are decorative

`scopes_requested` in `fibre.app.json` is "declarative only — not checked at
request time" (guide, Open gaps). The manifest the planner ships asks for four
scopes; nothing verifies or limits them.

While every app is first-party this is a tidiness problem. The moment an app is
genuinely third-party it is the whole security model. Scope enforcement should
land in the same change as `app_key` — a key carries scopes, the middleware
checks them, and a request outside them 403s.

---

## 4. Smaller gaps, same theme

| Gap | Fix |
|---|---|
| No self-registration endpoint | `POST /api/v1/apps` creating a `pending` row, admin-approved. Depends on §1. |
| `POST /apps/:slug/links` is person-only | Organisation links. The planner's manifest declares a `festival_host` → `organisation` mapping that cannot be written today. |
| No bulk linking | `POST /apps/:slug/links:bulk`. N parallel POSTs works but is not an integration story. |
| `activity_types` informational | The API accepts any snake_case type, so a typo lands silently on a workspace timeline. Validate against the registered manifest. |
| No curator-data write API | Apps that want to annotate a person have no generic surface. **Still open** — build-plan item 9a. |

---

## Suggested order

1. **§1 catalogue + lifecycle.** Everything else is blocked behind it, and it is
   the one that changes "no" to "yes".
2. **§2 `app_key` + §3 scope enforcement together.** They are one security
   model; shipping keys without scopes would be worse than today.
3. **§4** as follow-ups.

## How to verify it worked

The planner is the test case. It should be able to, without anyone running SQL:

1. Register itself and be approved by an admin.
2. Be activated on a workspace from `settings/apps`.
3. Hold a key scoped to that workspace, with no user session present.
4. Link an organiser to a `person` and a host to an `organisation`.
5. Emit `fot_planner.plan.created` onto the workspace timeline.
6. Be refused when it asks for something outside its scopes.

Step 6 is the one that proves the model, not just the plumbing.

All six pass, as `apps/api/scripts/verify-external-app.mjs`. The script also
checks the cases the six steps imply but don't name: a pending app cannot be
activated, a key cannot be minted with a scope the manifest never asked for, a
key cannot act as another app, an undeclared activity type is refused, and
suspending the app kills its keys on the next request.

## Context

- `docs/building-on-the-fibre.md` — the intended path.
- `docs/fibre-vs-app-data.md` — the platform/app data wall.
- `~/Projects/festivaloftrust.com/docs/fibre-integration.md` — the integration
  attempt and what it hit.
- `~/Projects/festivaloftrust.com/fibre.app.json` — a real external manifest.
