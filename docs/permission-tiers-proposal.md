# Permission tiers — resolved design

_v2, 2026-05-17. Reflects Sjoerd's answers to the first round of open questions._

## Mental model (brief-level)

These three things are first-class on The Fibre platform:

1. **Organisation** — the tenant. Has app subscriptions, billing, admin. Can be formal (a registered company) or informal (a working group, a friendship circle).
2. **Person** — a human in the contact graph. **A person belongs to one OR MORE organisations.** A person's data — name, email, contact info — is owned by the platform.
3. **User** — a person who can sign in. Each user is anchored to an organisation; a single human (one `person`) can be a `user` in several organisations.

People and organisations enter Fibre through an app — Meet, Sales, Updates (newsletter), The Thread, or a future third-party app. The first member of a new organisation becomes its admin.

Once registered, an organisation can expand its app portfolio. Admins control which apps are installed at **org level** (every member gets them) vs **member level** (just for themselves).

> **Brief delta**: the current `workspace` concept maps to `organisation`. We keep the column name `workspace_id` internally for now (less code churn), but the user-facing language everywhere becomes "organisation". A separate doc will eventually rename the column.

## What gets seen — three layers

### Layer 1: personal data

Owned by the user. Not visible to anyone else, including org admins. Concretely:

- **Personal bookings** — bookings on a meeting type with `team_id IS NULL`. Visible only to the host (and the invitee, via their email link).
- **Personal contacts** — contacts a user surfaces via personal interactions (e.g. they hosted a booking with them) but that no other context exposes.
- **Personal notes** — anywhere we add "private note" fields later, they live here.

Privacy by default. Even an org admin can't see another user's personal bookings.

### Layer 2: resource-scoped data (teams, threads, sales-teams)

Every shared resource — a Meet team, a Thread programme, a Sales team, a future kind — carries an explicit **visibility** setting:

| Visibility | Meaning |
|---|---|
| `members_only` (default) | Only members of this resource see it. |
| `org_wide` | Every `internal` member of the organisation sees it. (External members do **not**.) |

A resource's visibility can be changed by:
- The creator
- Any lead of that resource
- Any org admin

Within a resource, every member is **lead** or **member**. Any lead can flip another member's role lead↔member, add or remove members.

### Layer 3: organisation-wide data

Some platform data is org-wide by definition:
- The list of organisations a person is in (the org_membership graph)
- App subscriptions (`workspace_app`)
- Org-level branding / settings

Visible to `internal` org members. Org admins can edit.

## Who sees a given person

The platform contact graph (`public.person`) is the trickiest case because it aggregates across all the above. The rule:

A user sees `person P` if **any** of these is true:

1. **They're admin** of the org P lives in.
2. **They share a resource** — same Meet team, same Thread programme, same Sales team. (Visibility of that resource doesn't matter; co-membership is enough.)
3. **P is in an `org_wide` resource** in their org, AND the user is `internal`.
4. **They hosted a booking** with P. (Personal context — only the host sees it.)
5. **P is the user themselves.**

Otherwise: not visible.

`internal` vs `external` only changes rule 3. Externals never get the org_wide widening; they only see what they've been explicitly added to.

## Schema additions

### `public.user`

```sql
alter table public."user"
  add column workspace_role text not null default 'member'
    check (workspace_role in ('owner','admin','member')),
  add column relationship_type text not null default 'internal'
    check (relationship_type in ('internal','external'));
```

`workspace_role`:
- `owner` — there's exactly one owner per org. First user, billing contact. Can transfer.
- `admin` — manage members, install apps, change resource visibilities. Multiple per org.
- `member` — default. Standard org-member rights.

`relationship_type`:
- `internal` — colleague, part of the org. Gets org-wide widening.
- `external` — partner, freelancer, alumni-style access. Sees only what they're a direct member of.

(Dropped `team_member`, `partner`, `alumnus` from the v1 draft — they were synonyms. The label can come back later as a richer "status" field if we need it for UX.)

### `meet_team`, `programme`, future `sales_team`

```sql
alter table public.meet_team
  add column visibility text not null default 'members_only'
    check (visibility in ('members_only','org_wide'));

alter table public.programme
  add column visibility text not null default 'members_only'
    check (visibility in ('members_only','org_wide'));
```

Same shape applied to every "team-shaped" resource we add.

### Capacity for multi-org persons

We don't change `user.workspace_id` (still 1:1) but we tighten `public.person` ↔ `public.org_membership` so the contact graph supports a person belonging to many orgs cleanly. The schema already allows this (org_membership is a join table); we just need to make sure the UI and the RLS predicates don't assume a single org per person.

## RLS pattern

A single SECURITY DEFINER helper handles the whole policy:

```sql
create or replace function public.can_see_person(p_person_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  with me_user as (
    select id, person_id, workspace_id, workspace_role, relationship_type
      from public."user"
     where id = current_user_id()
  ),
  target as (
    select id, workspace_id from public.person where id = p_person_id
  )
  select case
    -- workspace match required
    when (select workspace_id from target) is distinct from (select current_workspace_id()) then false
    -- self
    when (select person_id from me_user) = p_person_id then true
    -- admin or owner of the org
    when (select workspace_role from me_user) in ('owner','admin') then true
    -- shared resource (Meet team, programme, future sales team)
    when exists (
      select 1
        from public.meet_team_member tm1
        join public.meet_team_member tm2 on tm1.team_id = tm2.team_id
        join public."user" u2 on u2.id = tm2.user_id
       where tm1.user_id = (select id from me_user)
         and u2.person_id = p_person_id
         and tm1.status = 'active' and tm2.status = 'active'
    ) then true
    when exists (
      select 1
        from public.programme_enrolment pe
       where pe.programme_id in (
               select programme_id from public.programme_enrolment
                where person_id = (select person_id from me_user)
             )
         and pe.person_id = p_person_id
    ) then true
    -- in an org_wide resource AND I'm internal
    when (select relationship_type from me_user) = 'internal' and exists (
      select 1
        from public.meet_team t
        join public.meet_team_member tm on tm.team_id = t.id
        join public."user" u on u.id = tm.user_id
       where t.visibility = 'org_wide'
         and t.workspace_id = (select workspace_id from me_user)
         and u.person_id = p_person_id
    ) then true
    -- hosted a booking with them (personal context — only the host)
    when exists (
      select 1 from public.meet_booking b
        join public.meet_host h on h.id = b.host_id
       where b.invitee_person_id = p_person_id
         and h.user_id = (select id from me_user)
    ) then true
    else false
  end
$$;
```

Then the RLS policy on `public.person` becomes:

```sql
alter policy person_scope on public.person
  using (
    public.has_app_membership('fibre-platform')
    and public.can_see_person(id)
  );
```

Performance: each clause is `exists` against an indexed predicate. The function is called per row on SELECT, but Postgres will inline it and short-circuit. We need indexes on:
- `meet_team_member (user_id)` ✓ (already)
- `meet_team_member (team_id, user_id)` (compound, add)
- `programme_enrolment (programme_id, person_id)` (compound)
- `meet_booking (invitee_person_id)` ✓ partial index already
- `meet_team (workspace_id) where visibility = 'org_wide'` (partial, add)

Same helper shape for activity-feed visibility (`can_see_activity(activity_id)`) and organisation visibility.

## What the booking visibility means concretely

- Personal MTs: only the host's name on the booking. `meet_booking.host_id` matches the host's user. No one else sees these rows.
- Team MTs: members of that team see the booking. If the team is `org_wide`, all internal org members see it.

The booking-list RLS expands to:

```sql
alter policy meet_booking_scope on public.meet_booking
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
    and (
      -- I'm the host
      exists (select 1 from public.meet_host h
                where h.id = meet_booking.host_id
                  and h.user_id = public.current_user_id())
      -- I'm a member of the team that owns the MT
      or exists (select 1 from public.meet_meeting_type mt
                   join public.meet_team_member tm on tm.team_id = mt.team_id
                  where mt.id = meet_booking.meeting_type_id
                    and tm.user_id = public.current_user_id()
                    and tm.status = 'active')
      -- The MT's team is org_wide and I'm internal
      or exists (select 1 from public.meet_meeting_type mt
                   join public.meet_team t on t.id = mt.team_id
                   join public."user" u on u.id = public.current_user_id()
                  where mt.id = meet_booking.meeting_type_id
                    and t.visibility = 'org_wide'
                    and u.relationship_type = 'internal')
      -- I'm an org admin
      or exists (select 1 from public."user" u
                  where u.id = public.current_user_id()
                    and u.workspace_role in ('owner','admin'))
    )
  );
```

## UI changes

### Invite form (Meet team + internal-team + future apps)

- **Relationship** select: `Internal · External`. Defaults to Internal.
- Hint text: "Internal members see org-wide resources. External members only see things they're added to."

### Team detail page (`/teams/[id]`)

- New **Visibility** card: radio `Members only` / `Org-wide (visible to all internal org members)`. Editable by lead or org admin.
- Member rows show role chip (`Lead` / `Member`).

### Internal team page (`/internal-team`)

- Each row shows the relationship-type chip (`Internal` / `External`) and workspace role (`Owner` / `Admin` / `Member`).
- Org admins can edit both.

### Contacts page (`/contacts` in Fibre web)

- Empty-state copy explains visibility when the user sees fewer contacts than expected: "You see N contacts because of your relationships. Ask an admin to widen your access."

### Apps page (`/settings/apps`)

- App-install scope toggle: `Install for the organisation (everyone)` / `Install for me only`. Already exists conceptually via `workspace_app` + `app_membership` — we make it explicit.
- A "Subscriptions" tab placeholder when billing lands.

## Migration ordering

To keep this shippable in one focused session:

1. **Schema** — add `workspace_role` + `relationship_type` to `user`; add `visibility` to `meet_team` + `programme`. Single migration.
2. **Backfill** — set `workspace_role='owner'` for the first user in each workspace; everyone else `member`. Set `relationship_type='internal'` for current users. All resources `members_only`.
3. **`can_see_person()` helper + RLS update** for `public.person` and `public.meet_booking`.
4. **API updates** — invite endpoints accept the new fields; team PATCH accepts `visibility`.
5. **UI updates** — invite forms, team detail card, internal-team chips.

Activity-feed visibility, organisation visibility, the multi-workspace `workspace_member` extraction — all defer to follow-ups.

## What I want to confirm before coding

Three small ones, then I'll start:

1. **Owner vs admin**: do we need both today, or is `admin` enough? Owner adds complexity for billing-handoff scenarios we don't have yet. **Lean: admin only.**
2. **External in an org_wide team**: today an external member of a team still sees the team. If the team flips to org_wide, do they additionally see the org-wide widening to other persons? **Lean: no — external means "only what I'm explicitly added to," period.**
3. **Lead = automatic admin?**: a team lead doesn't automatically get org-admin rights. Confirmed. (You said so explicitly.)

If you say "go" on these three I ship the slice.
