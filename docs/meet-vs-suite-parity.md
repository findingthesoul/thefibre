# Fibre Meet vs Soul Suite — the parity ledger

_2026-09-07. Written from a read of both codebases: Suite v1.1.0
(`/Users/sjoerdair/Projects/souls calendar`, Prisma/Postgres, standalone on
`suite.soul.com`) and Meet (`apps/meet` + `apps/api/src/routes/meet.ts`).
Companion to [`cutover-suite-to-meet.md`](cutover-suite-to-meet.md), whose
open question #2 — "are there Suite-only features I haven't accounted for?"
— this answers._

## Why the comparison runs both ways

Meet is the rebuild of Suite, so the interesting question turned out not to
be "what does Meet still lack" but both halves at once. Suite is a better
**calendar app** than its age suggests; Meet is a better **platform
citizen**. Cutover day is where the first half bites.

## What Suite never had (Meet-only)

Mostly consequences of being on the platform rather than an island:

| | Suite | Meet |
|---|---|---|
| Identity | its own login on soul.com | one Fibre account, SSO across the app family |
| Contacts | local `Contact` rows built from bookings; die with the app | bookings carry `invitee_person_id` → the platform person, with a Meet tab on their Fibre profile |
| Cross-app trail | none | `activity` events + `purchase` ledger rows the other apps can see |
| Money | own payments page, own invoice counter | the shared Invoices area (scope Me/Team/Workspace, reimburse, mark paid, payment links, receipts) over one ledger |
| Fees | fixed | plan-aware `platformFeeCents`, subscriptions, plan gating |
| Payment settings | `Host.stripeAccountId` | payments SPoT shared with Thread (`lib/payment-accounts.ts`) |
| Languages | English | six locales for everything a visitor sees |
| Teams | local Projects | platform `team` rows shared with Thread/Flow, plus visibility |
| Data rights | one SAR export route | RLS-scoped EU Supabase, consent + erasure UI, soft delete |

Plus, feature-level: **booking approval** (`requires_approval` → approve /
reject), which Suite had no concept of, and **polls as a first-class event
type** that converts a winning slot into a real booking, where Suite kept
`Poll` beside meeting types.

## What Suite had that Meet didn't — and what we did about it

### Shipped in v0.59.0

1. **Zoom.** Per-user OAuth, meetings created at booking time, moved on
   reschedule, deleted on cancel; cross-org co-hosts fall back gracefully
   (Suite's own retry). The credential lives in the connections SPoT
   (`user_connection.zoom_refresh_token`), NOT on `meet_host` — Zoom rotates
   refresh tokens on every use, so `lib/zoom/host.ts` is the only sanctioned
   caller: it caches, coalesces concurrent refreshes and persists rotations.
   **Needs a Zoom Marketplace app** — see `docs/deploy.md` § Zoom.
2. **Reschedule.** `POST /meet/public/bookings/:id/reschedule` +
   `?reschedule=<id>` on the booking page. The booking KEEPS ITS ID: the
   purchase ledger points at it by `item_ref`, so cancel-and-rebook would
   orphan the payment. The Google event is patched in place, so the join
   link survives.
3. **Round-robin fairness, per meeting type.** Meet's rule was hardcoded
   least-loaded; now `least_loaded | least_recently_assigned |
   strict_rotation | random` (`lib/meet/round-robin.ts`, pure + unit
   tested). "Last assigned" is read back off the bookings — no counter
   column to drift, unlike Suite's `ProjectMember.lastAssignedAt`.
4. **Per-team availability.** `meet_team_member_hours` — "for THIS team I'm
   free Tue–Thu" without touching personal hours. Resolution order in
   `buildPerHostArgs`: meeting-type override → team override → host hours.
   (The meeting-type override was silently skipped for multi-host types
   before this; that's fixed in passing.)
5. **`.ics` download.** One builder (`lib/ical.ts`), served by the API,
   proxied at `/{owner}/{mt}/confirmed/{id}/calendar.ics` so the link stays
   on the app's domain; also linked from the confirmation email.

Also in the same release: **reimbursement from a booking**, which does NOT
port Suite's per-booking refund. The ledger is the record and
`POST /purchases/:id/refund` is the one implementation; the dialog is the
shared `@thefibre/shared/ui/refund-confirm`, the same one the Invoices page
opens.

### Still open

| Suite feature | Note |
|---|---|
| Onboarding wizard + guided tour | Covered by [`onboarding-proposal.md`](onboarding-proposal.md) — an emergent checklist per app, not a stored wizard. Being built there; not tracked here. |
| PWA (manifest, service worker, offline shell, installable) | Meet is mobile-responsive (bottom nav, sheets) but not installable. |
| Branding page (logo/colours on public booking pages) | The platform has `workspace_brand`; Meet's public pages don't read it yet. |
| Admin recovery: retry-finalize | For a paid booking whose calendar/email step failed. Refund is done. |
| Dirty-nav guard + sticky SaveBar | Meet's forms save explicitly; Suite warned on leaving a dirty form. |
| Microsoft Teams conferencing | Neither app has it — Suite's branch awaited an Azure AD registration. |

## The thing worth keeping from Suite's design

Suite's fairness enum carried its reasoning in a comment on the enum itself,
so the rule and its rationale could not drift apart. That style is why the
port went in cleanly a year later, and it is worth copying whenever a policy
choice gets a column.
