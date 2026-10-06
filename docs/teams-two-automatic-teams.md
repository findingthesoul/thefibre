# Two automatic teams in every workspace

**Status: spec, for Sjoerd to read before any code is written.**
Asked for 2026-10-06 (inbox 2l). Nothing below is built.

---

## What was asked for

Every workspace gets two teams it does not have to create:

- **Admins** — its members are exactly the workspace's admins. One writer
  keeps that true; nobody maintains it by hand.
- **Everyone** — the default. Every new member lands in it, and the apps
  granted to Everyone are what a newcomer gets.

New workspaces start with every app their plan allows activated and granted to
Everyone. Inviting somebody becomes "pick their teams", with Everyone already
ticked; ticking an individual app stays possible but becomes the exception
rather than the normal way in.

Existing workspaces are converted too: current members into Everyone, current
admins into Admins, by a script run per database — dry run first, restore
proven, staging before production, and production only on Sjoerd's word.

## What exists today, so the rest reads clearly

Teams are already the access layer; this adds no new concept.

- `team` is a platform primitive, scoped to a workspace, with
  `is_published` (2026-09-11) separating an internal access group from a team
  with a public page.
- `team_app_grant` says which apps a team confers, with `lead_is_app_admin`
  for whether team leads get app-admin.
- `team_member.role` is `lead | member`.
- `lib/team-grants.ts` resolves all of that into `app_membership` rows.
  **Enforcement does not move**: `workspace_app` still says what a workspace
  runs, `app_membership` still says what a person may open. Teams are the
  intent; those two remain the truth.
- The Members page can still tick an app directly; such a row is marked
  `is_direct` so the resolver knows not to remove it.

So the work is: create two teams per workspace, keep one of them in sync with
a field that already exists, make the other the default, and convert what is
already there.

---

## A blocker found while writing this, which changes the shape

**Team slugs are globally unique, and a team claims its slug even when it is
unpublished.** `public_root_slug.slug` is the primary key, shared by
workspaces, teams and organisers, so the first workspace to own `everyone`
owns it for everybody. Creating a team called "Everyone" in every workspace
fails on the second one.

That is not a detail to discover during implementation; it decides what these
teams are called in the database. Three ways:

1. **Suffix the slug with the workspace** — `everyone-soul-com`,
   `admins-soul-com`. Deterministic, readable, works today, needs no schema
   change. Costs two global segments per workspace, and the slug goes stale if
   the workspace is renamed — invisible, since these teams are never
   published.
2. **Do not claim a slug for automatic teams.** Cleanest in principle: an
   internal team that will never have a public page has no business reserving
   a public address. But it reverses a deliberate decision — Sjoerd,
   2026-09-11: *"when creating it, published or not, it claims that slug…
   this way we prevent future collisions"* — and touches the trigger that
   every team write goes through.
3. Random suffix. Works, reads like machine output in any admin screen that
   shows a slug.

**Recommendation: 1.** It is reversible, needs no change to a trigger
everything depends on, and keeps the "always claim" rule Sjoerd chose. 2 is
the better end state and should be a separate, deliberate change if he wants
it — not smuggled in under a teams feature.

---

## The two teams

### Admins

Membership **mirrors** `workspace_member.workspace_role in ('admin',
'super_admin')`. It is not editable by hand.

One writer keeps it true, firing wherever the workspace role changes: a role
change on the Members page, the first-admin seeding of a new workspace, an
invite accepted as admin, a demotion. A person made admin joins Admins; a
person demoted leaves it, and the apps they held *through* Admins go with
them, which is the behaviour anyone would expect and the reason to do this at
all.

**This needs saying in the UI, not just here.** A team whose member list
cannot be edited, with no explanation, reads as broken. The team page should
say that membership follows the workspace role and point at where to change
it. Without that sentence, the first thing anybody does is try to add somebody
and conclude the feature is broken — which is exactly the class of bug fixed
in v1.108.0 this week.

### Everyone

Every member of the workspace is in it. New members land in it without anybody
choosing that.

**An open question, and I would rather raise it than pick:** can somebody be
*removed* from Everyone?

- **No, membership is absolute.** Then "Everyone" means what it says, and the
  grant list is a genuine floor: every member has at least these apps. To give
  one person less than the floor you must lower the floor for everybody —
  which is the honest consequence, and usually a sign the floor is wrong.
- **Yes, it is a default rather than a guarantee.** More flexible, and the
  name becomes a lie the first time somebody is removed. An admin screen
  showing "Everyone (except Maria)" is a thing people have to think about
  every time they read it.

**Recommendation: No — absolute.** The value of this feature is that a
newcomer's access is predictable and visible in one place. The moment Everyone
has exceptions, "what does a new person get?" stops having an answer, and the
per-person exception already exists for cases that need it: tick the app
directly on the Members page, which is `is_direct` and survives. There is
currently **no way to deny** an app a team grants, and I am not proposing to
add one — denial rules are where access models become unexplainable.

---

## New workspaces

On creation: every app the plan allows is activated (`workspace_app`) and
granted to Everyone (`team_app_grant`). The first admin lands in both teams.

This matches what already happens — `ensurePlanApps` activates plan apps on
creation — and adds the grant so that activation actually reaches people.

## Inviting somebody

The invite dialog becomes **pick teams**, with Everyone ticked and not
unticked by default. Admins appears in the list but is not pickable, for the
same reason its membership is not editable: you make somebody an admin by
giving them the role.

Direct app ticks stay, below the teams, framed as the exception: "or give them
a single app". The existing `is_direct` mechanism already keeps those working.

---

## Converting existing workspaces

A script per database, following the bulk-conversion rule already in use:
**dry run first, restore proven before anything is written, staging before
production, production only on Sjoerd's own word.**

For each workspace: create the two teams, put every live member in Everyone,
put every workspace admin in Admins, then let `lib/team-grants.ts` resolve.

**The one open choice, and it is his:** what does Everyone *start with* in an
existing workspace?

1. **Nothing.** Safe, changes nobody's access on conversion day, and the
   workspace's admin decides what the floor should be. Costs: the feature does
   nothing until somebody configures it, and most workspaces will never be
   configured.
2. **The union of what members already hold.** Everyone starts with the apps
   that current members actually use, so nobody gains and the floor is
   immediately meaningful. Costs: in a workspace where one person was given
   Pulse deliberately, Pulse becomes the floor for everybody — a silent
   widening of access.
3. **Every app the plan allows**, matching new workspaces. Most consistent,
   and the most likely to hand somebody an app they were deliberately not
   given.

**Recommendation: 1 for the conversion, with a visible prompt.** Convert
without changing anybody's access, then tell each workspace's admins, in the
product, that Everyone is empty and what it is for. Option 2 and 3 both change
who can open what, silently, in workspaces we do not own — and "nobody's
access changed on conversion day" is a sentence worth being able to say
without qualification. The cost is real: the feature sits inert until someone
acts. I would rather that than widen access by inference.

---

## Risks worth naming

- **The conversion writes `app_membership` rows through the resolver.** Those
  are the enforcement rows. A dry run must print the exact grants that would
  be added or removed, per workspace, and be read by a human before the real
  run — not a count, the rows.
- **Admins-as-mirror has a failure mode**: if the writer misses a path where
  the workspace role changes, somebody keeps admin-level app access after
  being demoted. The sync must be driven from one function that every role
  change calls, and there should be a check that finds drift rather than
  trusting that every path was found.
- **Two more teams in every workspace** means the team pickers, team lists and
  anything counting teams now always show at least two. Worth a pass over the
  surfaces that list teams before shipping, so none of them says "you have no
  teams yet" next to two teams.

## What I would build, in order

1. The slug decision above, then the two teams with the sync writer and a
   drift check.
2. New-workspace creation granting plan apps to Everyone.
3. The invite dialog as team-picking.
4. The conversion script: dry run, restore, staging, then production on his
   word.

Nothing starts until the two open questions are answered: **removal from
Everyone** (my recommendation: not allowed) and **what Everyone starts with in
existing workspaces** (my recommendation: nothing, with a prompt).
