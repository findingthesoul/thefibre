# Stress-test pass — 2026-09-25

The second full round, eleven days after `docs/stress-test-2026-09-14.md`,
run from v1.57.1 (staging and production level) in its own worktree beside
ten peer sessions. Same cycle: every scripted layer first, then targeted
hunts, then fixes with a test each, then this record.

## Read this first

1. **One tenancy hole, in production, now closed.** `POST /persons/merge`
   and `POST /persons/merges/:id/undo` checked that the caller was an admin
   of *their* workspace and then handed the body's UUIDs to a service-role
   function that only checks the two persons share *a* workspace. An admin of
   any workspace could merge, and since 20260925053333 copy the personal data
   between, two persons of another workspace by id, and put back any
   workspace's merge. Needs two foreign UUIDs (unguessable, not enumerable);
   returns no foreign data. Fixed in the routes with the same lookup
   `/duplicates/distinct` already had, and proven both ways by
   `persons-merge-tenancy.int.test.ts` (refused across, still works inside).
   **Promote when you are ready; nothing else in this round needs a decision
   first.**
2. **Four organiser screens that nobody had rendered are now rendered every
   run.** `e2e/organiser-screens.spec.ts` signs in as the fixture user and
   checks the calendar tray and its dialog, the ticket badge, Add
   participant's person search (name AND email fill), and the Connections
   card. All four work on staging. The first attempt at the search timed out
   on a cold function and passed on retry; the spec now budgets for that.
3. **The ticket badge was on the wrong row on approval-gated threads.** It
   keyed on "any system row"; an approval-gated thread seeds two (received
   and confirmed) and only the confirmed one carries the ticket. Exactly the
   thread it was written for got two badges. Now the confirmed row only.
4. **Editing the "application received" message was a 400.** Its trigger
   (`on_application`) has been in the column's check since 20260901180000
   and in nothing else: not the API's zod, not the editor's type, not the
   timeline's labels. Saving that row's wording failed and the row rendered
   undated and unlabelled. All four places now know the value; the editor
   offers "When they apply" on approval-gated threads.

## Layers, as run (all green before any edit)

| Layer | Result |
|---|---|
| `pnpm verify` (migration versions, sw freshness, app names, typecheck, unit, prod smoke, public API on prod) | green — 964 unit tests across 99 files |
| Integration pack on staging | 16 files, 129 tests |
| External-app walk, MCP personal, public API — staging | green |
| Stripe webhooks — staging test mode | 4 endpoints, right mode, right events |
| SECURITY DEFINER audit — staging AND production | every function closed or open on purpose |
| Root slugs, workspace admins — staging AND production | green |
| Smoke staging, SSO hop staging | green |
| Playwright golden paths + exploratory | 23 passed |

Then the hunts, each a read-only agent over the whole tree:

- **CHECK constraints vs what the app can send.** Prompted by Meet's
  `event_type` (four months of refused polls). Every literal CHECK in 226
  migrations resolved to its latest definition and compared with zod, TS
  unions and literal writes. **No other value the app sends that the
  database refuses.** Three lists were narrower than the column: the
  engagement trigger (item 4 above), the external-app thread route refusing
  `fr` (widened, additive), and a `'free' as never` cast on a purchase
  method the type had accepted for two months (cast removed). One stale read
  type on `workspace_member.workspace_role` (`'admin' | 'member'`, three
  months after `member` stopped existing) corrected.
- **Errors coalesced into empty collections** (testing approach §1.9). The
  sweep found thirteen places where a failed read renders as "there are
  none" for someone who should see entries. Fixed where the wrong answer
  does harm: Meet availability (a failed read offered every booked slot as
  free — worse than empty), the sole-admin guard (failed open: the last admin
  could step down), the visitor portal (`/my`: enrolments, certificates,
  bookings, memberships, agenda, RSVPs) and the member portal (memberships,
  purchases, invoices). One helper, `apps/api/src/lib/rows.ts`, throws the
  PostgREST error so the route answers 500 and the log names the query. The
  rest are listed in the build plan with file and line; they are real and
  they are not launch-blocking.
- **`team ?? organiser` where the truth is three-way.** Two Stripe redirect
  builders (the manual-add payment link and the resend from Invoices) sent a
  workspace-scoped thread's payer back to the organiser's address after
  paying — reachable, not canonical. Both now use `publicOwnerSlug`. Still
  two-way, on purpose and noted in the build plan: the published embed
  payload's `organiser_slug` (a semantic change to a published field would
  break embedders; needs a versioned field) and the pricing panel's default
  destination (UI says personal, charge routes to workspace until saved —
  Sjoerd's call which side is right).
- **The merge fill migration (20260925053333)**, reviewed at its author's
  request. Five findings handed to thefibre-0f, who fixed the four in the
  migration the same hour (undo no longer clobbers a post-merge edit; the
  column filter is type- and suffix-based with a classifying test; `{}`
  counts as blank; the trigger functions are revoked). The fifth is item 1.

## What I did not do

- Did not touch production data (reads only: two audits and the public
  smoke).
- Did not change the embed contract or the payment-destination default.
- Did not fix the silent-empty sites outside the portals, availability and
  the admin guard; they are listed, not lost.
- Did not render Outlook or Apple Mail for the calendar invitations, nor a
  certificate with a background image (thefibre-60's list); both need
  fixtures that do not exist on either stack yet.

## Open for you

- **Promote.** Item 1 is in production until you do.
- **Payment destination default** (build plan): for a thread with no team
  and no saved destination, the panel shows "personal" when the organiser
  is connected, the server charges the workspace account. Pick one.
- **Embed `organiser_slug`**: add `owner_slug` beside it, or leave.
