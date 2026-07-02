# Platform SPoT — members management & the public profile

_Decision with Sjoerd 2026-07-02. Feeds brief v0.5. Shipped in phases from
v0.13.76._

## The principle

Two things grew per-app that belong to the platform:

1. **Who is in the workspace and what can they use** — Meet and Thread each
   built an "Internal team" page (differently). Membership is platform data
   (`workspace_member`, `app_membership`); managing it in every app violates
   the single-point-of-truth rule and guarantees drift.
2. **The organiser's public face** — `meet_host` and `thread_organiser`
   both carry slug / display name / bio / photo / timezone. Same human,
   two profiles.

## Target model

### Members (Phase A)
- **The Fibre (thefibre.app) Settings → Members is canonical**: list
  workspace members (workspace role, internal/external relationship,
  per-app access), invite by email (creates pending user + person, grants
  chosen apps, sends the sign-in invite — Meet's proven mechanics,
  generalised), edit role/relationship, toggle per-app access.
- Platform API: `GET/POST /api/v1/members`, `PATCH /api/v1/members/:userId`.
- **Apps show, the platform manages**: Thread's Internal team becomes a
  read-only view + "Manage in The Fibre" link. Meet keeps its working page
  for one transition release with a banner pointing at the platform; its
  local management UI is then retired.

### Public profile (Phase B)
- New platform table `user_profile` (1:1 with `user`): `display_name`,
  `bio`, `photo_url`, `timezone`. Backfilled by coalescing
  `meet_host` ← `thread_organiser` values.
- Platform API `GET/PATCH /api/v1/profile`; edited on thefibre.app
  Settings → Profile.
- **Apps inherit with overrides**: `meet_host` / `thread_organiser`
  display fields become optional overrides — when null, the app reads the
  platform profile (merge happens in the app's `/me` endpoints). New
  organiser/host provisioning seeds from the profile.
- **Slugs stay per-app for now** (meet.thefibre.app/x and
  thread.thefibre.app/x are separate namespaces with separate collision
  rules — team slugs share Thread's). Unifying them is a candidate for
  brief v0.5 proper; not done in this slice.

## Non-goals (this slice)
- Workspace switching / multi-workspace membership (separate roadmap item).
- Retiring `meet_host`/`thread_organiser` columns — they stay as overrides.
- Participant identity (`/my`) — separate track.
