# Bug — a new workspace has no admin, and cannot be given one from the UI

_Found 2026-08-26, setting the Festival planner up in a second workspace._

## What happens

Approving an access request creates a workspace. The first person signs in.
Everything looks normal — they see the workspace, its contacts, its apps.

Then anything behind `requireWorkspaceAdmin` answers **403**:

- `GET /apps/:slug/keys` — "Couldn't load keys: API 403"
- `POST /apps/:slug/keys` — cannot mint a key
- the members screen, which is the one place that could fix it

So an external app can be approved platform-wide and activated on the
workspace, and still never be given a credential there.

## Why

`requireWorkspaceAdmin` (`routes/apps.ts`) reads `workspace_member` for
`(user_id, workspace_id)` and requires `workspace_role` of `admin`.

Nothing creates that row for a new workspace's first user. The signup-request
handler says user and person rows "are created at first sign-in via the existing
sso/resolve flow" — and that flow does create a `user`, but no
`workspace_member`. Grepping the API, `workspace_member` is only ever written by
`routes/members.ts` (the members admin screen) and `routes/meet.ts`.

So the first user has no membership row at all, therefore no role, therefore no
admin rights over the workspace they just created. And `members.ts` is behind
the same check, which closes the loop: **the only way to grant the role is a
screen that requires the role.**

Solidarity Lab does not hit this because it predates the flow and was seeded
directly.

## A second, smaller thing

The guard tests for two roles:

```ts
if (role !== 'admin' && role !== 'super_admin') return 'workspace admin required';
```

but the column only permits two values, and `super_admin` is not one of them:

```sql
workspace_role text not null default 'member'
  check (workspace_role in ('admin','member'))
```

So the `super_admin` branch is unreachable. Harmless today, but it reads as
though a role exists that does not, and the next person to touch this will
believe it.

Worth noting too that platform super admin (`user.is_super_admin`) is a
different thing entirely — it is what lets someone approve an app registration.
Having it does not make you an admin of any workspace, which is a genuinely
surprising split when the same word appears in both.

## Suggested fix

When an access request is approved and the first user signs into that
workspace, give them `workspace_member` with `workspace_role = 'admin'`. The
person who asked for a workspace is its administrator by definition; there is
nobody else to be.

Either in the sso/resolve path when it creates the user, or at approval time
alongside the workspace insert — approval already knows the email.

Worth also considering a fallback in `requireWorkspaceAdmin`: if a workspace has
no admin at all, treat its earliest user as one. That way the situation cannot
recur for any workspace created before the fix.

## Working around it meanwhile

`~/Projects/festivaloftrust.com/supabase/seed/grant_fot_workspace_admin.sql`
inserts the membership row directly. It is idempotent and finds the workspace by
slug.
