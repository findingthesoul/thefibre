# Fibre Meet — API reference

_Last updated: 2026-05-16. All routes mounted at `/api/v1/meet/...` from `apps/api/src/routes/meet.ts`._

Auth model:
- Routes under `/api/v1/meet/public/...` and `/api/v1/meet/google/auth-callback` are **public** (no JWT, no `X-App-ID`). See `apps/api/src/middleware/app-context.ts`.
- Everything else is **authenticated** via the platform middleware: JWT in `Authorization: Bearer …` + `X-App-ID: fibre-meet` header, plus RLS scoping.

---

## Public — booking surface

### `GET /public/host/:host_slug`
Returns the host's landing-page payload.

```json
{
  "id": "uuid",
  "slug": "sjoerd",
  "full_name": "Sjoerd Luteyn",
  "avatar_url": null,
  "bio": "…",
  "photo_url": null,
  "location": "Amsterdam, NL",
  "timezone": "Europe/Amsterdam",
  "meeting_types": [ { "id": "…", "slug": "intro", "name": "Intro call", … } ]
}
```

### `GET /public/host/:host_slug/mt/:mt_slug`
Returns one meeting type + its host. Used by the public booking page.

### `GET /public/host/:host_slug/mt/:mt_slug/slots?from=ISO&to=ISO`
Returns bookable starts.

```json
{ "slots": ["2026-05-20T09:00:00.000Z", "2026-05-20T09:15:00.000Z", …] }
```

`from` defaults to `now`, `to` to `now + min(max_advance_days, 60) days`. Capped at 90 days. Uses `meet_meeting_type.working_hours_override` if set, otherwise the host's `working_hours`. Conflict-checks against confirmed bookings + Google freebusy on selected calendars.

### `GET /public/team/:team_slug` / `GET /public/team/:team_slug/mt/:mt_slug` / `GET /public/team/:team_slug/mt/:mt_slug/slots`
Team equivalents. The slots endpoint resolves the routing strategy (`event_type`):
- `one_on_one` → single-host generator (the team-MT's `host_id`)
- `round_robin` → union of all active assignees' slot sets
- `collective` → intersection
- `group` → not implemented

### `GET /public/resolve/:slug`
Slug router: returns `{ kind: 'host' | 'team', host_id?, team_id?, workspace_id }`. Used by the Meet front-end to decide what to render for `meet.thefibre.app/<slug>` without needing two round-trips. 404 if no match; 409 if the slug is ambiguous across workspaces.

### `POST /public/bookings`
Create a booking.

```json
// request
{
  "meeting_type_id": "uuid",
  "invitee_email": "guest@example.com",
  "invitee_name": "Guest Name",
  "invitee_answers": { "...": "..." },
  "starts_at": "2026-05-20T09:00:00.000Z",
  "request_id": "client-generated unique string"
}
```

Idempotent on `request_id`. Returns `{ booking: { id, starts_at, ends_at, request_id } }`. Emails the invitee + host (or all collective assignees). Writes a `meeting_booked` activity row.

### `POST /public/bookings/:id/cancel`
Flips status to `cancelled`. Deletes the GCal event (best-effort). Emails both sides.

### `GET /public/bookings/:id`
Public confirmation-page payload. Limited fields only.

### `GET /public/invite/:token`
Peek for the accept page. Returns `{ team, invitee, role, inviter }` or 410 if the token's already been used.

---

## Google OAuth

### `GET /google/auth-start` _(authed)_
Returns `{ url }` — the Google consent URL with a signed-JWT `state` carrying the user_id. The browser navigates to it.

### `GET /google/auth-callback` _(public)_
Google posts back here with `code` + `state`. We verify the state, exchange the code, persist the refresh_token on `meet_host`, sync the calendar list, redirect to `/settings/integrations?google=connected`.

### `POST /google/disconnect` _(authed)_
Clears the host's refresh_token and deletes their `meet_calendar` rows.

---

## Authenticated — host config

### `GET /me`
The current user's host row (auto-provisions on first call). `google_refresh_token` is sanitised out; `google_connected: boolean` replaces it.

### `PATCH /me`
Partial update. Accepts: `slug`, `bio`, `location`, `personal_room_url`, `timezone`, `working_hours`, `photo_url`.

---

## Meeting types

### `GET /meeting-types`
Returns the current user's personal types AND any team-owned types where they're a member.

### `POST /meeting-types`
Create.

```json
{
  "slug": "intro",
  "name": "Intro call",
  "description": null,
  "duration_minutes": 30,
  "buffer_before_minutes": 0,
  "buffer_after_minutes": 0,
  "min_notice_minutes": 60,
  "max_advance_days": 60,
  "conferencing_provider": "google_meet",
  "default_location": null,
  "is_active": true,
  "team_id": null,
  "event_type": "one_on_one",
  "working_hours_override": null,
  "conflict_calendar_ids": null
}
```

If `team_id` is set, the caller must be a `lead` of that team (enforced before insert).

### `PATCH /meeting-types/:id`
Partial; same shape as POST.

### `GET /meeting-types/:id/assignees`
Lists team-member assignees for a team-MT.

### `POST /meeting-types/:id/assignees`
`{ user_id, is_primary? }`. Lead-only. Setting `is_primary=true` clears any existing primary on this MT.

### `DELETE /meeting-types/:id/assignees/:userId`
Lead-only.

---

## Bookings

### `GET /bookings`
Bookings the current user hosts. Query params:
- `scope=upcoming|past|all` (default `upcoming`)
- `include_cancelled=1` (default off)
- `team_id=<uuid>|personal`

---

## Teams

### `GET /teams`
Teams the user is an **active** member of (`status='active'`). Each row includes `my_role`.

### `POST /teams`
`{ slug, name, description?, is_active? }`. Creator becomes lead. Rejects 409 if slug collides with any host or team in the workspace (`meet_root_slug` enforces).

### `GET /teams/:id`
Detail. Includes `members` (with `status`, `invite_token` if invited), `meeting_types`, `my_role`.

### `PATCH /teams/:id`
Lead-only. Same body shape as POST. Slug change recheckes namespace.

### `POST /teams/:id/members`
Invite by email. `{ email, name?, role? }`. Behaviour:
- If email already in this workspace → upsert membership as `active`.
- If email is new → create `user` (email_verified=false) + paired `person`, grant `fibre-meet` membership, insert team-member with `status='invited'` + `invite_token`, send invite email.
- If email is in another workspace → 409 (no silent cross-tenant moves).

Returns `{ role, status, invite_token?, user, invited: boolean }`.

### `POST /teams/:id/members/:userId/resend-invite`
Lead-only. Regenerates the token and re-sends the email.

### `DELETE /teams/:id/members/:userId`
Lead-only. Refuses to remove the last lead.

### `POST /teams/accept-invite/:token`
Authed. Flips `status='active'`, clears the token, grants `fibre-meet` membership. Verifies the signed-in user's email matches the invitee.

---

## Calendars

### `GET /calendars`
Synced calendars for the current host. `{ id, google_calendar_id, summary, role, created_at }`.

### `PATCH /calendars/:id`
`{ role: 'primary' | 'conflict_check' | 'write_target' | 'ignore' }`. Setting `primary` or `write_target` demotes any existing holder to `conflict_check` first.

### `POST /calendars/sync`
Re-pulls the calendar list from Google. Adds any new ones as `conflict_check`. Doesn't touch existing rows' roles.

---

## Workspace surfaces

### `GET /contacts`
Reads `public.person` for the workspace and decorates each row with Meet's booking summary. Query param `q` filters by name / email / domain.

```json
{
  "items": [
    {
      "id": "uuid", "name": "Marja van der B", "email": "m@…",
      "domain": "soul.com", "is_user": false,
      "meet_bookings": 3, "meet_last_booked_at": "2026-04-…"
    }
  ]
}
```

### `GET /internal-team`
Workspace-level user list with whether each has `fibre-meet` membership.

### `POST /internal-team`
Invite a workspace-level Meet user. Same shape as team-member invite, but grants only `fibre-meet` and doesn't add them to any team.

---

## Notable response shapes / conventions

- Errors: `{ error: string, code?: string, details?: any }` with the right HTTP status.
- All admin-client writes are wrapped in try/catch and log `console.error('[meet/<route>] …')` so Fly logs surface the underlying Postgres error.
- Embedded FK reads (PostgREST `select('thing:thing_id (col, …)')`) can return EITHER an object OR an array depending on the relationship cardinality. Always handle both:
  ```ts
  const obj = Array.isArray(row.thing) ? row.thing[0] : row.thing;
  ```
