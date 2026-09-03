# First-visit onboarding for Meet and The Thread — proposal

_2026-09-03. From Sjoerd's refinement note: "When coming to Meet the first
time (as a person, and as a workspace), it is maybe great that (1) there is a
configuration process starting for the person and for the organisation,
(2) there is a request for a tour." Status: **proposed — decisions D1–D3
below are open.**_

## The problem

A new user landing on Meet or The Thread today gets the full dashboard with
empty lists. Nothing tells them the three or four things that must be
configured before the app is actually usable (calendar connection, payment
account, a first meeting type / thread), and nothing offers to show them
around. The result is the "abstract build" feeling — the app works, but a
newcomer can't see the path to their first booking or enrolment.

Two distinct audiences, per Sjoerd's note:

- **The person** — their own connections and profile. In Meet: Google
  Calendar (`user_connection.google_refresh_token`), personal room URL,
  their Meet profile. In Thread: their organiser profile, personal payment
  account if they sell as themselves.
- **The workspace** — set up once by an admin. Billing/payment details
  (`workspace.stripe_account_id` / `invoice_details` via the payments SPoT),
  workspace slug/branding on public pages, the first meeting type (Meet) or
  first thread — ideally from the event template library (queue item 1e).

## Design: an emergent checklist, not a stored wizard

The Fibre's house pattern is that state is **derived from data, not
duplicated beside it** (per-app profile tabs appear because data exists;
plans gate by `plan_id`, never by copied flags). Onboarding should follow:

**A "Set up" card at the top of the dashboard, whose steps are computed from
what actually exists.** No `onboarding_state` table, no step counter that can
drift. Each step renders done/not-done by asking the data:

| Step (Meet, person) | Done when |
|---|---|
| Connect your Google Calendar | `user_connection.google_refresh_token` set |
| Add your video room | `personal_room_url` set (or Google Meet auto) |
| Complete your Meet profile | `person_meet_profile` row exists |
| Create your first meeting type | ≥1 meeting type owned by user |

| Step (workspace, admin only) | Done when |
|---|---|
| Workspace payment details | payments SPoT has account or invoice details |
| Invite your team | >1 active workspace member |
| First thread / meeting type | ≥1 exists in workspace |

- The card shows only while <100% done, with a "Dismiss" that is the ONLY
  stored bit (a per-user pref via the existing `savePref` mechanism —
  settings are per-user, not per-app).
- Admin steps appear only for `workspace_role` admin+; a plain organiser
  sees just the personal column. This is the "as a person, and as a
  workspace" split — same card, role-aware rows.
- Each row links straight to the existing surface (Settings → Connections,
  Settings → Payments, New meeting type…). **We build no new configuration
  screens** — the wizard IS the deep links plus done-detection.

## The tour

Keep it lighter than a step-by-step overlay library (no new dependency):

- First visit per app (per-user pref `tour_offered_<app>` unset) → a small
  dialog: "First time in Meet? Take the 2-minute tour" / "No thanks".
- The tour itself: a sequence of 4–5 dismissible callout cards highlighting
  the sidebar areas (Meet: meeting types → bookings → contacts → settings;
  Thread: threads → enrolments → certificates → settings), driven by a tiny
  shared component in `@thefibre/shared` so all apps can adopt it.
- "How The Fibre works" (Settings) already explains the platform — the tour
  links to it at the end rather than re-explaining the data wall.

## What this is NOT

- Not a signup flow — signup/approval already exists on the platform side.
- Not a blocking modal sequence. The dashboard stays usable behind the card;
  people who know what they're doing ignore it.
- Not per-workspace stored progress. Derived, always current: if an admin
  deletes the last meeting type, the step un-completes. That's honest.

## Decisions for Sjoerd

- **D1 — scope of v1.** Recommendation: Meet + Thread only (the note's two
  apps), card + tour offer; Flow/Pulse adopt the shared component later.
- **D2 — does the workspace card belong in each app or in Fibre web?**
  Recommendation: each app shows its own app-relevant steps; the
  platform-level ones (payment details, invite team) appear in whichever
  app the admin opens first — they're SPoT-backed, so completing them
  anywhere completes them everywhere.
- **D3 — tour content.** Claude drafts the 4–5 callouts per app; Sjoerd
  edits copy before ship.

## Build shape (once decided)

1. `@thefibre/shared`: `SetupCard` + `TourCallout` components, pref helpers.
2. API: one cheap `GET /api/v1/<app>/setup-status` per app (server computes
   the booleans — the card must not fire six queries from the client).
3. Meet dashboard card → Thread dashboard card → tour offers.
4. Est. one focused session; no migrations (prefs ride the existing
   mechanism; status is derived).
