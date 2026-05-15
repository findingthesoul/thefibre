# Fibre Meet — Data model

_Last updated: 2026-05-16. All Meet tables in the `public` schema, prefixed `meet_`._

This is a reference; for the running schema see the migration files in `supabase/migrations/`. Migrations are tracked by filename, not checksum — never edit an applied migration; write a fresh-timestamped one.

---

## Tables

### `meet_host`
One row per user who takes bookings.

```sql
id                    uuid pk
user_id               uuid not null unique → public."user"(id)
workspace_id          uuid not null → public.workspace(id)
slug                  text not null                     -- /<this>/<mt-slug>
bio                   text
location              text
personal_room_url     text                              -- shown when MT.conferencing = 'personal_room'
timezone              text not null default 'Europe/Amsterdam'
photo_url             text
working_hours         jsonb                             -- Schedule shape
google_refresh_token  text
created_at, updated_at
unique (workspace_id, slug)
```

### `meet_meeting_type`
A bookable offering. Owned by either a host (personal) or a team.

```sql
id                       uuid pk
workspace_id             uuid not null
host_id                  uuid not null → meet_host(id)    -- creator / single host / "primary" for team types
team_id                  uuid       → meet_team(id)       -- non-null = team-owned
slug                     text not null
name                     text not null
description              text
duration_minutes         int not null
buffer_before_minutes    int not null default 0
buffer_after_minutes     int not null default 0
min_notice_minutes       int not null default 60
max_advance_days         int not null default 60
conferencing_provider    text check in (google_meet|zoom|teams|in_person|personal_room|none)
default_location         text
is_active                boolean not null default true
event_type               text not null default 'one_on_one'
                           check in (one_on_one|round_robin|collective|group)
working_hours_override   jsonb                            -- per-MT availability override
conflict_calendar_ids    uuid[]                           -- per-MT calendar override (meet_calendar.id[])
price_cents              int                              -- not yet used (Stripe pending)
price_currency           text
intake_form_id           uuid → meet_intake_form(id)
created_at
-- partial unique indexes: (host_id, slug) where team_id is null
--                         (team_id, slug) where team_id is not null
-- check: event_type in (one_on_one, group) OR team_id is not null
```

### `meet_booking`
One row per booking.

```sql
id                      uuid pk
workspace_id            uuid not null
meeting_type_id         uuid not null → meet_meeting_type(id)
host_id                 uuid not null → meet_host(id)      -- chosen host (round-robin picks at booking time)
invitee_person_id       uuid → public.person(id)            -- platform contact-graph link
invitee_email           citext not null
invitee_name            text not null
invitee_answers         jsonb
starts_at, ends_at      timestamptz
status                  text not null default 'confirmed'
                          check in (confirmed|cancelled|rescheduled)
conferencing_provider   text
meet_url                text                                 -- google_meet hangoutLink
provider_meeting_id     text
alternative_location    text                                 -- snapshot of mt.default_location at booking time
google_event_id         text                                 -- nullable; only when synced
request_id              text not null unique                 -- idempotency key from client
payment_*               text                                 -- reserved for Stripe
created_at
```

### `meet_calendar`
Synced Google calendars per host. One row per calendar.

```sql
id                  uuid pk
host_id             uuid not null → meet_host(id)
workspace_id        uuid not null
google_calendar_id  text not null
summary             text
role                text not null
                      check in (primary|conflict_check|write_target|ignore)
created_at
unique (host_id, google_calendar_id)
```

### `meet_intake_form`
Per-MT structured questions.

```sql
id              uuid pk
workspace_id    uuid not null
host_id         uuid not null → meet_host(id)
name            text not null
fields          jsonb not null    -- IntakeField[] (see apps/meet/lib/intake.ts)
created_at
```

### `meet_team`
A workspace-scoped grouping with its own booking URL.

```sql
id            uuid pk
workspace_id  uuid not null
slug          text not null                    -- in same root namespace as meet_host.slug
name          text not null
description   text
is_active     boolean not null default true
created_by    uuid → public."user"(id)
created_at, updated_at
```

### `meet_team_member`

```sql
team_id        uuid not null → meet_team(id)
user_id        uuid not null → public."user"(id)
role           text not null default 'member'  check in (lead|member)
status         text not null default 'active'  check in (active|invited)
invite_token   text
invited_at, accepted_at, created_at
primary key (team_id, user_id)
-- partial unique on (invite_token) where not null
```

### `meet_meeting_type_assignee`
Which team members can take a round-robin / collective MT.

```sql
meeting_type_id  uuid not null → meet_meeting_type(id)
user_id          uuid not null → public."user"(id)
is_primary       boolean not null default false
created_at
primary key (meeting_type_id, user_id)
-- partial unique on (meeting_type_id) where is_primary = true   -- at most one primary per MT
```

### `meet_root_slug`
Shared root namespace so a workspace can't have a host slug colliding with a team slug.

```sql
workspace_id  uuid not null
slug          text not null
kind          text not null check in (host|team)
host_id       uuid → meet_host(id) on delete cascade
team_id       uuid → meet_team(id) on delete cascade
primary key (workspace_id, slug)
-- triggers on meet_host and meet_team keep this table in sync
```

---

## SQL helpers (security-definer)

Defined in migrations; used by RLS and route handlers.

| Function | Purpose |
|---|---|
| `public.current_user_id()` | Returns `app_user_id` claim from JWT (the platform-side `user.id`). |
| `public.current_workspace_id()` | JWT claim. |
| `public.has_app_membership(slug)` | True if current user has `app_membership` for the named app. |
| `public.meet_is_team_lead(team_id)` | SECURITY DEFINER — bypasses RLS to check if current user is a lead of a team. Used to break the recursive-policy trap on `meet_team_member`. |
| `public.ensure_user_person(user_id)` | SECURITY DEFINER — guarantees a paired `public.person` row exists for a user, linked both ways. Called from `resolve_sso_identity` on every match path. |
| `public.resolve_sso_identity(...)` | The SSO entry point. Provider-id match → email match → create. Each path now backfills the person link. |

---

## RLS pattern

Every Meet table has RLS enabled. Most tables follow the simple shape:

```sql
create policy meet_<table>_scope on public.meet_<table>
  for all to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
  )
  with check (
    workspace_id = public.current_workspace_id()
    and public.has_app_membership('fibre-meet')
  );
```

Exceptions:

- **`meet_team_member`** has split policies: SELECT goes through `meet_team` (which has standard RLS) so it never touches itself; INSERT / UPDATE / DELETE use `meet_is_team_lead()` (SECURITY DEFINER) to break recursion.
- **`meet_meeting_type_assignee`** reads when the user has `fibre-meet` AND the MT's team is in this workspace; writes require lead-of-team via `meet_is_team_lead`.
- **`meet_root_slug`** is workspace-scoped SELECT only; writes are trigger-driven.

Admin paths in the API use the service-role client (`adminClient`) to bypass RLS deliberately — e.g. the public booking POST writes into `meet_booking` for an invitee who isn't an authenticated user.

---

## The identity invariant

Every workspace user has a paired `public.person` row. Three enforcement points:

1. **Team invite** — `apps/api/src/routes/meet.ts` `POST /teams/:id/members` calls `ensurePersonForEmail(...)` before inserting the user.
2. **Internal-team invite** — same.
3. **`resolve_sso_identity()`** — calls `ensure_user_person()` on every match path.

A startup heal block in `20260516010000_sso_link_existing_person.sql` runs `ensure_user_person()` for every user with `person_id IS NULL`. Run-once at deploy time; idempotent.

Why: per brief §2, identity + contact graph are platform-owned. Meet (and every app) should write its data tagged with the platform's `person_id`. A user-without-a-person is unreachable from the contact graph and breaks Fibre Contacts.

---

## Migration index (Meet-related)

| Filename | What it does |
|---|---|
| `20260514170000_meet_schema.sql` | Initial schema: meet_host, meet_calendar, meet_intake_form, meet_meeting_type, meet_booking + RLS |
| `20260515010000_seed_meet_demo.sql` | Seed sjoerd's meet_host + 2 sample MTs |
| `20260515020000_meet_teams.sql` | meet_team, meet_team_member, meet_root_slug + sync triggers |
| `20260515030000_fix_team_member_rls_recursion.sql` | meet_is_team_lead() + split per-verb policies |
| `20260515040000_meet_event_types.sql` | event_type column + meet_meeting_type_assignee + check constraint |
| `20260516000000_meet_calendar_ignore_role.sql` | Adds 'ignore' to meet_calendar.role |
| `20260516010000_sso_link_existing_person.sql` | ensure_user_person() + resolve_sso_identity backfill + startup heal block |
| `20260516020000_meet_team_member_pending.sql` | status + invite_token + invited_at + accepted_at columns |
| `20260516030000_meet_meeting_type_overrides.sql` | working_hours_override + conflict_calendar_ids columns |

Apply with `supabase db push` from repo root.
