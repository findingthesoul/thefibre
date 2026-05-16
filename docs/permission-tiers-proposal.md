# Permission tiers — design proposal

_Draft, 2026-05-17. For discussion before any code._

## The ask (from Sjoerd, 2026-05-16)

> "When I invite another team member, he logs into The Fibre — should I not be able to set per-user what they can see in The Fibre? For example:
> 1. Only contacts of events/meetings/sales-processes he/she is part of
> 2. Only contact info from teams he/she is part of
> 3. Contacts info of the organisation he is part of."

And, separately:

> "When inviting someone, it should be stated what someone's status is: part of this team (in Meet), external, internal (colleague/part of the org)."

These are two intertwined asks. Both belong in the brief (this is platform-level, not Meet-specific).

---

## What today's model actually says

The v0.4 brief has **one access axis** plus app-level gating:

1. `user.workspace_id` decides which workspace's data RLS allows you to read.
2. `app_membership(user_id, app_id, role)` decides which apps you can use.
3. `workspace_app(workspace_id, app_id)` decides which apps the workspace has activated.

Inside a workspace, every member who has `fibre-platform` membership sees the whole contact graph. There's no "this user can see Marja but not Daniel."

That's fine for soul.com today (everyone trusts everyone). It breaks the moment a workspace invites someone who shouldn't see the full graph — a freelancer, a partner-org contact, an alumnus.

Sjoerd's three tiers above are about adding a **second axis**: within-workspace visibility.

---

## Two concerns, one solution? Or two?

### Concern A: Visibility scope per user
"This person can only see contacts they're connected to."

### Concern B: Invite-time status labelling
"When I invite X, tell me whether they're team-member, internal, or external."

These look like the same thing but they're not.

- **A is enforcement** — RLS-level, decides what queries return.
- **B is metadata** — UX-level, helps inviters reason about what they're doing.

We probably want both, and they reference each other (an "external" user defaults to the most restrictive visibility scope, an "internal" user defaults to full).

---

## Proposed model

### 1. A new table: `workspace_member`

Today `user.workspace_id` is a foreign key — a user belongs to exactly one workspace. That worked when "workspace member" was a binary. Now we need attributes per (user × workspace) without exploding the schema.

Two options:

**Option α — Add columns to `user`**

```sql
alter table public."user"
  add column workspace_role text not null default 'member'
    check (workspace_role in ('owner','admin','member','restricted')),
  add column relationship_type text not null default 'internal'
    check (relationship_type in ('internal','external','team_member','partner','alumnus'));
```

Simple. Works because we have a 1:1 user↔workspace today.

**Option β — Introduce `workspace_member`**

```sql
create table public.workspace_member (
  user_id              uuid not null references public."user"(id),
  workspace_id         uuid not null references public.workspace(id),
  workspace_role       text not null default 'member'
                          check (workspace_role in ('owner','admin','member','restricted')),
  relationship_type    text not null default 'internal'
                          check (relationship_type in ('internal','external','team_member','partner','alumnus')),
  visibility_scope     text not null default 'full'
                          check (visibility_scope in ('full','connected','team_only')),
  joined_at            timestamptz not null default now(),
  primary key (user_id, workspace_id)
);
```

More work today, but future-proofs the "user belongs to multiple workspaces" case (e.g. consultants serving multiple orgs). The brief flirts with this in §4 but doesn't commit.

**Recommendation: α now, β later.** Adding columns to `user` is cheap and doesn't break the 1:1 invariant. When we hit the first multi-workspace user we promote to `workspace_member`. Document this in the brief.

### 2. Visibility scopes

Three scopes a user can have within a workspace:

| Scope | What they see |
|---|---|
| `full` | Everyone in the workspace's contact graph. Default for `internal` + admin. |
| `connected` | Only people they have a direct context with — bookings they hosted, programmes they're enrolled in, teams they're on, orgs they're a member of. |
| `team_only` | Only people on teams they belong to. Strictest. Defaults for `external`. |

These are enforced by RLS on `public.person`, `public.organisation`, and the activity log. The predicates are non-trivial — they need to check existence across multiple tables (meet_booking, team_member, programme_enrolment, org_membership).

**Implementation sketch — a SECURITY DEFINER helper:**

```sql
create or replace function public.can_see_person(p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (select id, workspace_role, visibility_scope from public."user" where id = current_user_id()),
       p  as (select workspace_id from public.person where id = p_person_id)
  select case
    when not exists (select 1 from me) then false
    -- Workspace match is always required first
    when (select workspace_id from p) is distinct from (select current_workspace_id()) then false
    -- Admins + 'full' scope see everything in the workspace
    when (select workspace_role from me) in ('owner','admin') then true
    when (select visibility_scope from me) = 'full' then true
    -- 'team_only': share a team
    when (select visibility_scope from me) = 'team_only' then exists (
      select 1
        from public.meet_team_member tm1
        join public.meet_team_member tm2 on tm1.team_id = tm2.team_id
        join public."user" u on u.id = tm2.user_id and u.person_id = p_person_id
       where tm1.user_id = current_user_id()
    )
    -- 'connected': share a team OR a programme OR a booking OR an org membership
    when (select visibility_scope from me) = 'connected' then (
      -- shared team (via the linked user → person on tm2)
      exists (
        select 1
          from public.meet_team_member tm1
          join public.meet_team_member tm2 on tm1.team_id = tm2.team_id
          join public."user" u on u.id = tm2.user_id and u.person_id = p_person_id
         where tm1.user_id = current_user_id()
      )
      -- hosted a booking with this person as invitee
      or exists (
        select 1 from public.meet_booking b
          join public.meet_host h on h.id = b.host_id
         where b.invitee_person_id = p_person_id
           and h.user_id = current_user_id()
      )
      -- shared programme enrolment
      or exists (
        select 1 from public.programme_enrolment e1
          join public.programme_enrolment e2 on e1.programme_id = e2.programme_id
          join public."user" u on u.person_id = p_person_id
         where e1.person_id = (select person_id from public."user" where id = current_user_id())
           and e2.person_id = p_person_id
      )
      -- shared org
      or exists (
        select 1 from public.org_membership om1
          join public.org_membership om2 on om1.organisation_id = om2.organisation_id
         where om1.person_id = (select person_id from public."user" where id = current_user_id())
           and om2.person_id = p_person_id
      )
    )
    else false
  end
$$;
```

The function returns true only when the visibility predicate passes. Then RLS on `public.person` becomes:

```sql
alter policy person_scope on public.person
  using (
    public.has_app_membership('fibre-platform')
    and public.can_see_person(id)
  );
```

Same shape for `public.organisation` (`can_see_org`) and the activity log (`can_see_activity`).

**Performance**: the function evaluates per row on SELECT. Postgres should still inline + cache; with indexes on the relationship tables (`team_id, user_id`, `invitee_person_id`, `programme_id`, `organisation_id, person_id`) this is fast enough at our current scale. Will need EXPLAIN ANALYZE on the seeded workspace.

### 3. Invite-time `relationship_type`

Five values cover the cases Sjoerd raised:

| Value | Meaning | Default `workspace_role` | Default `visibility_scope` |
|---|---|---|---|
| `internal` | Colleague, part of the org running this workspace | `member` | `full` |
| `team_member` | On one of the workspace's teams (e.g. Meet team) | `member` | `team_only` |
| `external` | Freelancer, partner, consultant; needs login but minimal access | `member` | `connected` |
| `partner` | Another org's contact who needs view-into-shared-work access | `member` | `connected` |
| `alumnus` | Used to be team_member, still has access to their history | `member` | `team_only` |

These are **defaults**. The inviter can override the visibility scope explicitly. The relationship_type stays as metadata + the label shown on /internal-team.

### 4. UI surfaces

**On invite forms** (`/teams/[id]` invite + `/internal-team` invite):
- Add a "Relationship" radio/select: `Internal · Team member · External · Partner · Alumnus`
- Show derived default visibility scope as a sub-label
- Advanced: an explicit "Visibility scope" select that overrides the default

**On `/internal-team`**:
- Each member row shows their relationship + visibility scope as small chips
- Lead can edit (workspace_admin only)

**On `/contacts`** (Fibre web):
- An empty-state explanation when a restricted user sees fewer contacts than they expected: "You see N contacts because of your visibility scope. Ask an admin to widen it."

---

## Open questions for Sjoerd

1. **`team_only` semantics** — does "team I belong to" mean Meet teams only, or Thread programmes too? Or any "group the platform knows about"?
2. **Admin vs lead vs member** — should team-lead automatically widen scope to "everyone on your team" or stay independent?
3. **Should `external` users see their OWN past bookings?** (Probably yes — even with `connected`, you should always see things you're directly part of.)
4. **What about ACTIVITY rows?** Should restricted users see workspace-wide activity, or only activity that touches a person they can see?
5. **Are these values fixed, or workspace-configurable?** (e.g. could a workspace add a custom relationship type `'volunteer'`?)
6. **First migration scope** — ship α (columns on `user`) or jump to β (`workspace_member` table)?

---

## What I'd build first (if you approve the model)

A minimum-viable slice we could ship in one session:

1. Add `workspace_role` + `relationship_type` + `visibility_scope` columns to `public.user` (defaults: `member`, `internal`, `full`).
2. Add the `can_see_person()` SECURITY DEFINER helper.
3. Update RLS on `public.person` to call it.
4. Update both invite endpoints to accept + store the new fields.
5. Add the relationship-type select to the invite forms.
6. Add chips to `/internal-team`.
7. Ship.

Then iterate: organisation visibility, activity visibility, the over-time tracking ("became alumnus on date X"), the multi-workspace `workspace_member` migration when we need it.

---

## Why this matters for the brief

This is a §6 ("Data ownership and minimisation") amendment. Today the brief is silent on within-workspace visibility — implicitly everyone-sees-everything. With this proposal:

- Workspace admins still see everything.
- Members default to full visibility but can be scoped.
- External/partner/alumnus relationships default to restricted scope, configurable.
- The platform formally enforces "an app justifies the field" AND now "a relationship justifies the visibility."

That's a coherent extension of the existing design philosophy.
