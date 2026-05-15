# Fibre Meet — Architecture

_Last updated: 2026-05-16, v0.7.x_

Fibre Meet is the booking app inside The Fibre. It's a Suite-class scheduler (Calendly-shaped) that's been re-anchored on Fibre's platform primitives:

- **One workspace = one contact graph.** Anyone Meet touches gets a row in `public.person` so they're visible in `thefibre.app/contacts`. Apps add curator-data; they don't own identity.
- **Apps own their own tables, prefixed `meet_*`.** They cross the platform wall only via the activity log.
- **Cross-subdomain SSO** so signing in on `thefibre.app` also signs you into `meet.thefibre.app` (cookies on `.thefibre.app`).

This document is the running architecture reference for the Meet app. The platform-wide brief is `docs/fibre-technical-brief-v0.4.md`; this doc only zooms in.

---

## High-level shape

```
                                ┌───────────────┐
              browser ── HTTPS ─┤ apps/meet     │  Next.js 15 + RSC, on Vercel
                                │ (Next.js)     │  meet.thefibre.app
                                └────────┬──────┘
                                         │ JWT (Supabase Auth, shared cookie domain)
                                         ▼
                                ┌────────────────┐
                                │ apps/api/Hono  │  thefibre-api.fly.dev (Fly.io, fra)
                                │ /api/v1/meet/* │  also /api/v1/auth, /sso, /workspace-apps
                                └────────┬───────┘
                                         │ service-role key (for admin paths) +
                                         │ user JWT (for RLS-scoped reads/writes)
                                         ▼
                                ┌────────────────┐
                                │ Supabase / Pg  │  EU (Ireland), RLS-enforced
                                │ + Auth         │
                                └────────────────┘

External services Meet calls:
- Google Calendar API   (freebusy, calendarList, events.insert/delete)
- Google OAuth2         (offline tokens for the host's calendar)
- Resend                (transactional emails)
```

Web is **stateless** — no PII storage on Vercel. Every personal-data operation goes through the Fly API.

---

## What lives where in the repo

```
apps/meet/
├─ app/
│  ├─ page.tsx                                   landing (signed-out)
│  ├─ sign-in-button.tsx                         Google OAuth client kickoff
│  ├─ auth/callback/route.ts                     exchanges code, runs SSO resolve, redirects
│  ├─ no-access/page.tsx                         shown when fibre-meet not granted / activated
│  ├─ (app)/                                     authed shell (sidebar + topbar)
│  │  ├─ layout.tsx                              gates fibre-meet membership + activation
│  │  ├─ dashboard/                              Quick Links + Today + Next Up
│  │  ├─ meeting-types/                          list + tabbed editor + assignees
│  │  ├─ bookings/                               List / Week / Month with filters
│  │  ├─ teams/                                  list + detail (members + pending invites)
│  │  ├─ contacts/                               reads public.person, surfaces Meet history
│  │  ├─ internal-team/                          workspace-level Meet membership + invite
│  │  └─ settings/                               index → profile / availability / calendars / integrations
│  ├─ invite/[token]/                            public accept page for team invites
│  └─ [hostSlug]/                                public booking surface
│     ├─ page.tsx                                host OR team landing (resolves either)
│     └─ [mtSlug]/
│        ├─ page.tsx                             split-card meeting-type page
│        ├─ flow.tsx                             booking flow (calendar grid + time list)
│        └─ confirmed/[bookingId]/               confirmation + cancel/reschedule
├─ components/
│  ├─ shell/                                     sidebar, topbar, app switcher
│  ├─ ui/                                        page, field, list, name-slug, button, input, label
│  └─ working-hours-editor.tsx                   the per-day blocks editor
└─ lib/
   ├─ api.ts                                    apiFetch (JWT, X-App-ID)
   ├─ public-api.ts                              publicFetch (no auth)
   └─ supabase/{server,client}.ts                Supabase SSR + cookie-domain

apps/api/src/
├─ server.ts                                    Hono boot + CORS
├─ db.ts                                        adminClient (service-role) + userClient (JWT)
├─ middleware/
│  └─ app-context.ts                             JWT verify, X-App-ID header, PUBLIC_PREFIXES
├─ routes/
│  ├─ meet.ts                                    ~2300 lines — everything Meet
│  ├─ auth.ts, sso.ts, workspace-apps.ts         platform routes the web calls
│  └─ signup-requests.ts, etc.
└─ lib/
   ├─ availability/engine.ts                    pure slot generator + multi-host union/intersect
   ├─ google/client.ts                          OAuth + freeBusy + createEvent/deleteEvent
   └─ email/{client,templates}.ts               Resend wrapper + invite/booking templates

supabase/migrations/                            14-digit-timestamped SQL files
```

---

## Auth + identity

1. User clicks **Sign in with Google** on `meet.thefibre.app/`.
2. Supabase Auth handles the OAuth exchange. Cookies are set with `domain=.thefibre.app` so the session is shared with `thefibre.app` (Fibre web) and `thread.thefibre.app`.
3. `/auth/callback` calls our API's `/sso/access-check` to decide where to land them:
   - `existing` → they have a `public.user` row; land in that workspace
   - `approved` → a `signup_request` was approved; land in the new workspace
   - `pending` / `denied` / `unknown` → bounce to `/access-pending`
4. On first sign-in the API calls `/sso/resolve` → `public.resolve_sso_identity()` which:
   - Matches by provider-user-id (fastest)
   - Otherwise matches by `user.email` in the target workspace (the invite path)
   - Otherwise creates a brand-new `user` + `person` + `user_identity_provider` row
   - Either path calls `ensure_user_person()` so every user has a paired person row
5. The Meet app shell (`apps/meet/app/(app)/layout.tsx`) further gates on:
   - `app_membership` for `fibre-meet`
   - `workspace_app` for `fibre-meet` (workspace must have activated Meet)

### The identity invariant (brief §2 enforcement)

Every workspace user has a corresponding `public.person` row. This is enforced in three places:

- **Team-member invite** in `apps/api/src/routes/meet.ts` — creates a `person` + sets `user.person_id`.
- **Internal-team invite** — same.
- **`resolve_sso_identity()`** SQL function — calls `ensure_user_person()` on every match path, which is also run as a startup heal-block to clean up legacy rows.

Helpers in `apps/api/src/routes/meet.ts`:

```ts
ensurePersonForEmail(workspaceId, email, fullName): personId | null
linkPersonIfMissing(userId, workspaceId, email, fullName): void
```

These are the canonical places to extend if you add new entry points that create users.

---

## Data model

See `docs/meet-data-model.md` for full schema. Quick summary:

| Table | Purpose |
|---|---|
| `meet_host` | One row per user-who-takes-bookings. Carries timezone, working_hours, slug, google_refresh_token. |
| `meet_meeting_type` | One row per bookable offering. Owned by either a host (personal) or a team. Carries duration, buffers, conferencing, event_type, intake_form_id, and per-MT overrides. |
| `meet_booking` | One row per booking. Confirmed / cancelled / rescheduled. Has invitee_email + invitee_person_id (linked to `public.person`). |
| `meet_calendar` | Synced Google calendars per host with a role (primary / conflict_check / write_target / ignore). |
| `meet_team` | A workspace-scoped slugged group. Has members + meeting types. |
| `meet_team_member` | (team_id, user_id, role: lead\|member, status: active\|invited, invite_token). |
| `meet_meeting_type_assignee` | Which team members can run a round-robin or collective meeting type, with one is_primary. |
| `meet_root_slug` | Shared workspace-root slug namespace (host slugs and team slugs never collide). Populated by triggers. |
| `meet_intake_form` | Per-MT structured questions (used by the booking flow). |

All tables have RLS: `workspace_id = current_workspace_id()` and `has_app_membership('fibre-meet')`. Team-member writes use the SECURITY DEFINER helper `meet_is_team_lead(team_id)` to break recursion (we hit `42P17 infinite recursion` once; never again — see migration `20260515030000_fix_team_member_rls_recursion.sql`).

---

## Booking flow (the heart of Meet)

```
[Public]
  meet.thefibre.app/<slug>           ────►  GET /api/v1/meet/public/host/:slug
                                              (falls back to /public/team/:slug)
  meet.thefibre.app/<slug>/<mt-slug> ────►  GET .../mt/:mt_slug

  Click date / time:
  flow.tsx ─►  GET /api/v1/meet/public/{host|team}/<slug>/mt/<mt_slug>/slots
                ?from=…&to=…

  Submit:
  flow.tsx ─►  POST /api/v1/meet/public/bookings
                {meeting_type_id, invitee_email, invitee_name, starts_at, request_id, …}
```

### Slot generation

`apps/api/src/lib/availability/engine.ts` exposes two pure functions:

- `generateSlots(args)` — one host. Expands `workingHours` into UTC intervals (DST-safe via `lib/availability/timezone.ts`), slices into duration chunks at a 15-minute step, drops slots that violate min-notice / max-advance / overlap busy intervals (with buffers).
- `generateMultiHostSlots(mode, hosts[])` — many hosts. Computes each host's slot set with `generateSlots`, then UNION (round_robin) or INTERSECTION (collective).
- `rankAssigneesForSlot(slot, duration, hosts[], loadByKey)` — at booking time, picks the least-loaded host who's free at the requested slot.

### Per-MT overrides

`meet_meeting_type.working_hours_override` and `meet_meeting_type.conflict_calendar_ids` (both nullable jsonb / uuid[]). The slots endpoint uses the override if set; otherwise the host's defaults. Wired in two places (single-host route + `buildPerHostArgs`).

### Routing strategies

- `one_on_one` (default) — mt.host_id runs every booking.
- `round_robin` — `resolveAssigneeHostIds` reads `meet_meeting_type_assignee`, filters to status='active' team members. Booking picks the least-loaded free host.
- `collective` — same roster, but the **primary** runs the canonical event; the other assignees are added as Google Calendar attendees and receive the host-notification email.
- `group` — reserved (single host, many invitees). Not implemented.

### Booking POST flow (`apps/api/src/routes/meet.ts`)

1. Resolve the MT.
2. Find or create the invitee `person` (workspace-scoped).
3. Decide which host runs this booking (see Routing strategies).
4. INSERT the booking with `status='confirmed'`. Idempotent on `request_id` (23505 → return existing).
5. If chosen host has Google connected:
   - Find their write target calendar (`write_target` or `primary` role)
   - Call `createEvent(...)` — adds the invitee + (for collective) other assignees
   - Update the booking row with `google_event_id` + `meet_url`
6. Send emails: `bookingConfirmationInvitee` to the invitee; `bookingNotificationHost` to the chosen host; (collective only) the same template to each other assignee.
7. Write an `activity` row of type `meeting_booked` so The Fibre's timeline picks it up.

### Cancel flow

Public `POST /api/v1/meet/public/bookings/:id/cancel`:
- Status → `cancelled`
- GCal event deleted (best-effort)
- `bookingCancellation` email to both sides

Booking IDs are uuid; the link in the email is the capability. Same pattern Calendly uses.

---

## Team invites (two-step)

1. **Lead invites email** (POST `/teams/:id/members`):
   - If email is new: create `user` (email_verified=false) + `person` + link, grant `fibre-meet` `app_membership`.
   - Reject if email belongs to another workspace (409 — no silent cross-tenant moves).
   - Insert into `meet_team_member` with `status='invited'`, random `invite_token`.
   - Send email with `meet.thefibre.app/invite/<token>` link.
2. **Invitee opens the link**: public peek at `GET /public/invite/:token` returns team + invitee info. If not signed in, the page hands the OAuth flow `next=/invite/<token>` so they come straight back.
3. **Click Accept**: `POST /teams/accept-invite/:token` — flips status to `active`, clears token, grants `fibre-meet` membership (idempotent).

Pending members are excluded from:
- Round-robin / collective rosters (can't take bookings yet)
- The user's own `GET /teams` list (no team appears until accepted)

A pending row exposes **Copy link / Resend / Revoke** on the team detail page (`apps/meet/app/(app)/teams/[id]/members.tsx` → `PendingInviteRow`).

---

## Calendars

Google calendar list is fetched at connect time AND via a Re-sync button on `meet.thefibre.app/settings/calendars`. We use `minAccessRole: 'reader'` so subscribed calendars (Holidays etc.) and shared-write calendars all show up. Per-calendar roles:

- `primary` — host's primary GCal. At most one per host.
- `write_target` — where new bookings get created. At most one per host. Falls back to `primary` if none set.
- `conflict_check` — read for freebusy, never written.
- `ignore` — explicitly opted out.

`PATCH /api/v1/meet/calendars/:id` enforces the at-most-one rule for primary/write_target by demoting the previous holder to `conflict_check`.

> Operational gotcha: the Google Calendar API needs to be enabled in the Cloud Console project (`684373834036` for our prod creds). If a fresh project isn't enabled, every call returns `Google Calendar API has not been used … or it is disabled`. We catch and log but the user just sees an empty list. Fix in the Cloud Console.

---

## Emails (Resend)

`apps/api/src/lib/email/`:

- `client.ts` — Resend via fetch. No-ops with `[email] would send: …` when `RESEND_API_KEY` is unset.
- `templates.ts` — three templates: `bookingConfirmationInvitee`, `bookingNotificationHost`, `bookingCancellation`. Plain text + HTML, formatted in the host's timezone.

The invite-email template is inline in the team-member route handler (separate copy because it needs the `meet.thefibre.app/invite/<token>` URL). Worth extracting later.

Required Fly secrets: `RESEND_API_KEY`, `EMAIL_FROM` (default `The Fibre <noreply@thefibre.app>`). Sending domain `thefibre.app` is DKIM-verified in Resend.

---

## Design canon

Things Sjoerd has called out, baked in:

- **Icons must be `lucide-react`, never emoji.** Settings, bookings view toggle, new-MT menu, public booking meta — all converted. Watch for drift.
- **Slug UX is centralised** in `apps/meet/components/ui/name-slug.tsx`: `[prefix/][input][Alt]`. Every form uses this. The Profile slug input is hand-styled to match.
- **Content is left-aligned, not centered.** `PageContainer` is `${MAX[max]} px-10 py-10` — no `mx-auto`.
- **Minute fields are curated dropdowns**, not free-form numbers (Buffer / Notice / Advance).
- **Personal vs Team is a 2-card chooser**, never a select. Team picker dropdown appears below the cards.
- **Light grey page background, white cards.** `Section` component renders `bg-surface-raised border border-line p-6`.

The design canon comes from the original Suite source at `/Users/sjoerdair/Projects/souls calendar/`. Before adding a screen, **read the equivalent Suite component**:

```bash
find "/Users/sjoerdair/Projects/souls calendar/src" -type f -name "*.tsx" | grep -i <thing>
```

Don't rebuild from screenshots alone — that's been the source of several fidelity gaps.

---

## Cross-cutting gotchas (real ones we've hit)

- **Supabase RLS recursion.** A `FOR ALL` policy whose `USING` clause queries the same table will hit `42P17`. Use a `SECURITY DEFINER` helper (`meet_is_team_lead`) and split into separate per-verb policies.
- **PostgREST FK embeds return object OR array.** Always handle both: `const u = Array.isArray(row.user) ? row.user[0] : row.user`.
- **Supabase migrations are tracked by filename, not checksum.** Editing an applied migration is a no-op. Write a fresh-timestamped file.
- **`.maybeSingle()` errors on multiple rows.** If a query that should be unique can return 0/1/2+, you'll get a silent null in `data` and an error in `error`. Check both.
- **PKCE `code_verifier` mismatch.** Caused by stale cookies / clicking sign-in twice. Tell users to use a fresh window.
- **Fly machine lease stuck.** A half-completed `fly deploy` holds the lease for ~15 minutes. You can't `--force` destroy it from a different token. Wait it out.
- **Google Calendar API disabled.** New OAuth project must explicitly enable the Calendar API in Cloud Console; otherwise every call 403s.

---

## Deploy

```bash
# from repo root
supabase db push                         # apply pending migrations to remote
git push origin main                     # Vercel auto-deploys web/meet/thread
fly deploy --remote-only                 # API (Fly.io)
```

The canonical `fly.toml` lives **at the repo root** so the Dockerfile (which copies the monorepo) gets the full repo as build context. Don't pass `--config apps/api/fly.toml` — older docs say that but recent flyctl resolves the dockerfile path wrong with that flag.

See `docs/deploy.md` for the full setup procedure including secrets.

---

## What's queued (priority)

1. **Magic-link auth** — non-Google invitees. Supabase Auth supports it natively. Needs:
   - A "Sign in with magic link" button on `/` (Meet) and `/` (Web).
   - The auth callback already exchanges a code; magic-link sends a code in the URL too — same path may just work.
   - SSO resolve / access-check don't need changes (they're provider-agnostic).
2. **Fibre web — label per-app curator data tabs**. The "Edit change context" modal on a person's profile shows fields from some external app but doesn't say which. Add the app name + slug above each curator-data section.
3. **Per-user permission tiers** (Sjoerd's longer-term ask). Brief amendment first; then RLS work. Big scope, talk it through.
4. **Cutover** with `suite.soul.com`. Decide whether Meet runs in parallel or aims for a clean swap.
5. **Visual fidelity passes**. Read the Suite component, then port.
