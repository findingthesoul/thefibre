# Teams as access groups — proposal

_2026-09-11. Sjoerd's design, from the question "I'm adding more apps and I
don't want every app available to everyone in a workspace."_

## The decision

A workspace admin already creates teams. Those same teams also decide which
apps their members can open. No new grouping concept.

Gated to **Pro and above** (Sjoerd, 2026-09-11).

## Why teams and not a new entity

The first sketch of this was a new `member_group` table. Teams are better,
and the codebase says so:

- **`team` is already a Fibre primitive.** It was renamed out of Meet in May
  (`20260517220000_rename_meet_team_to_team.sql`) precisely because sibling
  apps consume it natively. It is workspace-scoped, it has members, it has
  `is_active`.
- **`team_member.role` is already `lead | member`.** That maps onto the
  app-level `admin | member` distinction `app_membership` already carries, so
  the "can this group confer app-admin" question answers itself instead of
  needing a design.
- **The naming problem disappears.** "Role" is taken twice over — workspace
  level and app level. "Profile" belongs to people. Introducing "group"
  alongside "team" would have meant explaining the difference forever.

Nothing about enforcement changes. `workspace_app` still decides what a
workspace runs, `app_membership` still decides what a user may open, and RLS
still does the enforcing. This is an assignment layer that writes the same
grant rows a human ticks by hand today.

## Three things in the way

These are real and found in the code, not hypotheticals. All three need
handling in the same slice.

### 1. Teams are publicly addressable

`team.slug` is a public address. Team threads live under it and every public
URL builder reaches for it — CLAUDE.md already warns that public
organiser-slug queries must filter `.is('team_id', null)` for this reason.

So creating a "Finance" team to let the bookkeeper into Pulse would also
claim a public address and stand up a public-facing team page. That is a
surprising side effect for what was meant as an internal permission, and it
collides with the one-public-address-one-owner rule.

**Fix:** add `team.is_published boolean not null default true`. An internal
team has no public page. Existing teams migrate as published and keep their
slugs untouched.

**The slug is claimed either way** (Sjoerd, 2026-09-11): creating a team
reserves its segment whether or not it is published, so an internal team can
be published later without a collision. This needs no new work. The
`public_root_slug` table landed on 2026-09-09 and its triggers already claim
a row for every team, globally, with the slug as primary key — a second
claimant gets a unique violation instead of two silently 404ing pages.

The cost is real and accepted: an internal group in one workspace consumes a
public word for everyone. A private team called "finance" denies that segment
to every other workspace on the platform. The create form should say the slug
is a public address and let the admin edit it.

### 2. The team RLS policy requires Meet

`team_scope` reads:

```sql
workspace_id = public.current_workspace_id()
and public.has_app_membership('fibre-meet')
```

This is circular the moment teams grant apps. A finance-only person has no
Meet membership, so they cannot see the team that is supposed to be giving
them Pulse. The policy has to widen to workspace scope, with the Meet
condition moving to the Meet-specific surfaces that actually need it.

This is the highest-risk part of the change and should carry its own
migration and its own test.

### 3. Teams live under Meet in the API and the UI

The routes are `/api/v1/meet/teams*` and the management screen is
`apps/meet/app/(app)/teams/`. Granting apps is a platform act; an admin
should not have to open Meet to decide who gets Pulse.

**Fix:** add platform routes at `/api/v1/teams*` and a Teams screen in Fibre
settings next to Members. Keep the Meet routes as aliases — they are not part
of the published `/api/v1/apps/*` contract, but Meet and the web app both
call them, so removing them is churn for no gain.

## Schema

```sql
alter table public.team
  add column is_published boolean not null default true;

create table public.team_app_grant (
  team_id    uuid not null references public.team(id) on delete cascade,
  app_id     uuid not null references public.app(id)  on delete cascade,
  -- Plain membership for everyone in the team. A team LEAD is upgraded to
  -- app admin at resolution time when lead_is_app_admin is set, so the grant
  -- row stays about the app and the person's standing stays on team_member.
  lead_is_app_admin boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (team_id, app_id)
);
```

## Resolution

A user's effective app grants are the **union** of every grant from every
active team they belong to, plus the direct grants an admin ticked on their
member row. Union, never intersection: nobody loses access by joining a team.

Direct grants stay. The exception person is always there, and fighting the
bundle over them is how a system like this gets abandoned.

Resolution is a function in `lib/` that both the member-save path and the
team-save path call. It writes `app_membership` rows the way
`syncAppGrants` does today, so every existing reader keeps working and there
is no second source of truth about who may open what.

**Grants apply immediately** to everyone already in the team. Sjoerd did not
pick between this and going-forward-only, so this is the assumption: it is
what people expect from a group, and going-forward-only produces two people
in one team with different access and no way to see why. The cost is that
adding an app to a team silently widens access for people added months ago,
which the confirmation step below is there to make un-silent.

Removing an app from a team revokes it, unless the user also holds it
directly or through another team.

## Plan gate

New feature key `team_access_groups` on `PlanFeature`, checked with
`can(workspaceId, 'team_access_groups')`. Refusals use `needsPlan` so the
message names the thing and the plan rather than just saying upgrade.

Adding the key is a deploy plus a checkbox in /admin/plans, per the
productisation note. Below Pro, teams behave exactly as they do now.

**On downgrade** (Sjoerd, 2026-09-11): editing is locked, grants keep
resolving. Nobody loses app access because a card failed.

But the apps themselves may fall out of the plan, and Sjoerd's rule is wider
than this proposal: **history is kept, editing is refused in apps the plan no
longer includes.** An app that drops out goes read-only rather than dark.

That does not exist today. Plan gates are per-action and mostly guard
*activation* — `workspace-apps.ts` refuses to switch an app on without the
feature, and an app already active keeps working after a downgrade. There is
one precedent worth generalising: `thread.ts` hands the UI a
`can_edit_structure` flag rather than hiding the surface.

**So read-only mode is its own slice, not a line in this one.** It needs a
resolver that answers "is this app writable for this workspace", every write
path in the affected app consulting it, and a banner that says why. Doing it
properly is a larger piece of work than teams-as-access-groups, and doing it
badly means data people cannot reach. Listed in the build plan separately.

## UI

**Fibre settings → Teams** (new), workspace admin only — the app picker is
not shown to a team lead. List of teams, each showing member count and app
chips. A team detail screen with name, description, members, the app
picker, and a published toggle that explains what publishing does.

**Fibre settings → Members.** The app checkboxes stay and keep their meaning
of a direct grant. Add a read-only line per member showing apps inherited
from teams, so an admin can tell why someone has Pulse without hunting.

**Confirmation on widening.** Saving a team that adds an app names how many
existing members are about to receive it. This is the whole defence against
the immediate-application choice above.

Per the components-first rule, the app picker is the one from the member row
dialog, extracted to `@thefibre/shared` and used by both.

## Migration path

1. `is_published` defaults true, so every existing team keeps its public page
   and its slug.
2. `team_app_grant` starts empty. No existing access changes on deploy.
3. Existing `app_membership` rows are untouched and stay direct grants.
4. Nothing is revoked by the migration itself. Every removal after it is an
   admin's explicit act.

## Non-goals

- Not touching `workspace_role`. Authority stays vertical and separate from
  function.
- Not touching the `/api/v1/apps/*` contract.
- Not a per-app permission system. A grant is still open-the-app, and
  finer-grained rules stay inside each app.
- Not nested teams.

## Decided (Sjoerd, 2026-09-11)

1. **Downgrade** — lock editing, keep grants. Plus the wider rule: apps
   outside the plan go read-only, history intact. See the plan-gate section.
2. **Who may edit team app grants** — workspace admin only. A team lead runs
   the team's work; they do not hand out apps.
3. **Publishing later** — allowed, because the slug is claimed at creation
   regardless. Already true in the schema.

## Still open

- Whether Meet's existing team screens stay where they are once Fibre
  settings grows a Teams screen, or become a link across to it.
- Whether an inactive team (`is_active = false`) keeps resolving grants. It
  should not, but nothing today treats that flag as access-bearing.
