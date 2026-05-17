# Cutover plan — `suite.soul.com` → Fibre Meet

_2026-05-17. Drafted under auto mode. Strategy decision; no code action
until Sjoerd greenlights or amends._

## Current state

- **Suite v1** runs at `suite.soul.com`. Source: `/Users/sjoerdair/Projects/souls calendar/`. Built in a week, still in production.
- **Fibre Meet** runs at `meet.thefibre.app`. v0.12.0 — feature parity for the event types Suite had, plus Group, One-off, and Meeting poll that Suite didn't.
- Same signed-in identity already crosses both domains (cookie domain `.thefibre.app`); soul.com is a separate trust boundary.

## Recommendation: **parallel run with a soft funnel, hard swap at T+8 weeks**

Three phases, not "flip a switch":

### Phase 1 — Soft funnel (weeks 0-4)
- Both Suite and Meet stay live.
- Add a banner to Suite: *"Suite is moving to Fibre Meet. [Start using Meet →]"* Banner links to a "claim my Meet account" flow that pre-fills name/email from the Suite session.
- **No** data migration yet — users start fresh on Meet. Acceptable because:
  - Meet is a scheduling tool; historical bookings on Suite have low ongoing value past 30 days.
  - Future bookings on Suite continue to honour Suite booking pages until cutover.
- Instrument: count Meet sign-ins from each Suite user.

### Phase 2 — Announce date (weeks 4-6)
- When >60% of weekly-active Suite users have at least one Meet sign-in, announce a hard-swap date.
- Two weeks' notice. In-app banner, one email blast (from `noreply@thefibre.app`, branded via the v0.10.0 pipeline).
- Email includes: cutover date, "your booking pages will move to meet.thefibre.app/{slug}", and a "preserve my Suite booking pages" opt-in (see Phase 3).

### Phase 3 — Hard swap (week 8)
- `suite.soul.com/*` → 301 to `meet.thefibre.app/*` (or to the closest Meet equivalent).
- For users who opted in: a one-shot migration script copies Suite `meeting_type` rows + slug aliases into Meet so booking links keep working.
- Suite codebase frozen, kept for archival reference for ~3 months, then archived to a `read-only` branch and the Vercel project paused.

## What's *not* in this plan, deliberately

- **No live data sync.** Building a two-way bridge between Suite and Meet is throwaway code. The funnel period replaces it.
- **No historical booking migration.** Calendar invites already exist in users' Google/Outlook; that's the source of truth for past bookings. Meet starts each user with a clean slate.
- **No Google OAuth re-grant flow for Suite users.** They re-connect Google on Meet during the funnel — same OAuth scopes Meet already requests.

## Open questions for Sjoerd

These four answers turn this from a draft into a green-lit plan:

1. **Who's on Suite today?** Rough headcount + whether they're internal soul.com users or external clients. Affects comms tone.
2. **Are there Suite-only features I haven't accounted for?** I've read the Suite repo's component names, not run the app. If Suite has e.g. invoicing, custom branding, or webhooks that Meet doesn't, those are gating.
3. **What does `suite.soul.com` resolve to?** Vercel project, custom domain, who owns the DNS. Determines whether the 301 is a 30-minute change or a week of coordination.
4. **Is preserving Suite slugs a real need?** If everyone re-creates their booking links on Meet, Phase 3's migration script doesn't need to exist. If even one user has a public booking link printed somewhere, it does.

## If you want a faster path

Strip Phase 1 + 2: just put a "Suite is moving — try Fibre Meet" banner on Suite today, and do the hard swap whenever the answers to questions 1-4 come back. The phased version is the safer-by-default; the faster version is fine if Suite's userbase is small and forgiving.

## What I will do once you greenlight

- Phase 1 banner on Suite (one PR in `souls calendar/`)
- Sign-in claim-flow on Meet (one PR in `thefibre/`)
- Phase 3 migration script (one PR, only if Q4 answer is yes)
- DNS 301 (you do this — it's not code I can run)

None of these are big. Total: ~2 days of focused work spread across the 8 weeks.
