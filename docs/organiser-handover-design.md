# Handing a thread to another organiser — design notes (v1)

Status: **design, not built.** Written 2026-10-16 by builder 4 for the
coordinator and Sjoerd. Every "today" fact below has a file:line so it can be
checked rather than trusted.

Sjoerd, 2026-10-14: *"Backlog: change organiser for a thread. With approval
from the departing organiser and the new one."*

## Scope

**v1 is ONE thread, handed to another organiser in the same workspace, with
both of them saying yes.** The current organiser proposes; the new one
accepts. A workspace admin may stand in for an organiser who has LEFT (the
second door, below) — the new organiser still accepts.

Out of v1: handing over all of a leaver's threads at once (the same request,
many rows — a later step), team threads (they already belong to the team: the
public owner and the payout follow `team_id`, so the organiser matters much
less there), and moving a thread to another workspace.

## The request

A new table, `thread_organiser_handover`:

| column | |
|---|---|
| `id`, `workspace_id`, `thread_id` | |
| `from_organiser_id`, `to_organiser_id` | `thread_organiser` rows; the new one is created on proposal if the account has none (as `POST /threads/:id/members` already does, thread.ts:2822-2908) |
| `proposed_by_user_id` | the organiser, or the admin on the second door |
| `door` | `organiser` \| `admin_departed` |
| `reason` | required on `admin_departed`, shown to the new organiser |
| `keep_as_host` | default **true** — see (6) |
| `status` | `pending` \| `accepted` \| `declined` \| `cancelled` \| `expired` |
| `expires_at` | proposal + **7 days** |
| `decided_at`, `decided_by` | |

One pending request per thread (unique partial index on `thread_id where
status = 'pending'`). RLS on, read by workspace members of that workspace,
written only through the routes. No table in the repo has request-with-expiry
+ accept yet; the nearest shapes are `meet_team_member` (`invited`/`active`,
`invite_token`, `accepted_at` — 20260516020000) and `signup_request`
(`decided_by`/`decided_at` — 20260514150000). This borrows from both.

**Expiry is checked, not swept:** accept refuses `expires_at < now()`, and
every read reports such a row as `expired`. A scheduler tick that flips the
stored status is optional tidiness, not correctness.

Routes (all under `/thread`, the organiser's session):

- `POST /threads/:id/handover {to_user_id, keep_as_host}` — only the thread's
  organiser. Runs the payment check for the NEW organiser (7) and returns it,
  so the proposer sees "they will need to connect payments first" before
  sending.
- `POST /threads/:id/handover {…, door: 'admin_departed', reason}` — the
  second door, gated below.
- `GET /handovers` — mine, incoming and outgoing, for the Threads list and the
  thread editor's banner.
- `POST /handovers/:id/accept | decline` — only the proposed organiser.
- `POST /handovers/:id/cancel` — only the proposer.

Emails: the proposal to the new organiser (with the thread, the reason on the
second door, what moves and what stays — the list in this document, in their
words); the outcome to the proposer, and to the departing organiser on the
second door when an address still exists. Visible in Thread: an "Incoming
handover" card on the Threads list and a banner on the thread editor for both
sides while it is pending.

### The second door — gated

A workspace **admin or super_admin** (`current_workspace_role()`), and only
when the current organiser has **left**: no `workspace_member` row for their
user in this workspace, or their account is gone. Not "is unresponsive" —
that is a judgement the system cannot make, and a door that opens on a
judgement is a door that is used on someone who was merely on holiday. The
reason is required, stored, shown to the new organiser and written to
`activity`. The new organiser still accepts.

## Accepting is one transaction

`accept` calls one SQL function, `accept_thread_handover(handover_id,
acting_user)` — `security definer`, **born closed** (revoked from `public`,
granted to `service_role` only, as the definer-function guard requires). In
one transaction it re-checks pending + not expired + the thread still has
`from_organiser_id`, then:

1. `thread_thread.organiser_id := to_organiser_id`;
2. records the old public address (1);
3. stamps any of this thread's purchase rows that lack `stripe_account_id` (2);
4. adds the old organiser as host if `keep_as_host`, and removes the new
   organiser's own host row if they had one (6);
5. marks the request accepted.

The side effects that call out (rooms, calendar notices, emails) run after
it commits, in the route, and are idempotent — the same split the booking and
enrol routes use. Activity: one append-only row, type
`thread_organiser_changed`, subject only.

## The seven points

### (1) The public address

Today: a personal-scope thread lives at `/{organiserSlug}/{threadSlug}`; the
owner segment is the organiser's slug (lib/public-owner-slug.ts:21-33), and
every public read finds the thread through `ownerThreadFilter`, which for an
organiser owner is `organiser_id = owner AND team_id IS NULL`
(thread.ts:6241-6248). Change the organiser and **every old link 404s** — the
page, the vat-quote (thread.ts:7551-7557) and the enrol POST
(7585-7594).

`thread_slug_history` exists (20261014171844:47-58) but is keyed on the
**thread** slug and looked up through the CURRENT owner
(`movedThreadSlug`, thread.ts:6253-6280), so it cannot answer "this owner's
thread moved to another owner".

Proposal: add `old_owner_slug text null` to `thread_slug_history` (and widen
its unique key to `(thread_id, old_slug, coalesce(old_owner_slug, ''))`).
Accept writes `(thread_id, old_slug = thread slug, old_owner_slug = old
organiser slug)`. When a public read under an organiser owner finds nothing,
it asks history by `(old_owner_slug, old_slug)` and answers the same 404 with
`moved_to: {owner_slug, thread_slug}` that a renamed thread already gets
(thread.ts:6566-6570) — so the existing client redirect works unchanged, now
across owners. Team- and workspace-scope threads are untouched: their owner
segment does not change.

Two things the request card says out loud, because no redirect fixes them:
the thread leaves the old organiser's public page and any **embed on an
outside website filtered by the old organiser's slug** (thread.ts:6941-6950)
— which is right, but the old organiser should hear it before saying yes.

### (2) Money

Already mostly right, because the ledger stores who and where:

- New sales resolve the destination at sale time from the CURRENT organiser
  (`threadDestinationAccount`, lib/payment-accounts.ts:130-158, called from
  the enrol route thread.ts:8190-8197). So from acceptance, card money goes to
  the new organiser's account (for `payment_destination = 'personal'`;
  `workspace` and a team lead's account do not change).
- Every purchase row stores `organiser_user_id` and `stripe_account_id`
  (purchase_ledger 20260704091000:17-18, 20260704160000:4). A card checkout
  writes its pending row when the checkout STARTS, with the account
  (thread.ts:8258); the webhook later sets `paid` and the account the charge
  landed on, and does not touch `organiser_user_id` (recordPurchase only
  writes fields it is given, lib/purchases.ts:74). So **a checkout opened
  before the handover and paid after it stays the old organiser's sale, on
  the old account** — correct.
- **Refunds** run on `purchase.stripe_account_id` (purchases.ts:596-628), so a
  refund of a past sale debits the old account. The ONE gap: rows without
  `stripe_account_id` fall back to `chargeAccountForItem`, which re-resolves
  from the thread's current organiser (payment-accounts.ts:180-230) — after a
  handover that would refund from the NEW organiser's account. Accept step 3
  closes it: before switching, stamp this thread's rows that lack
  `stripe_account_id` with what `chargeAccountForItem` resolves now.
- **Seller of record** on receipts and invoices follows the row
  (`sellerForSale(…, purchase.organiser_user_id)`, purchases.ts:295-312 and
  its callers 449-452, 508, 695-699, 805-808). Past invoices stay the old
  organiser's; new ones are the new organiser's. Open invoice-method sales
  stay with the old organiser until paid or cancelled — say so on the card.
- **VAT** follows the seller (`resolveSellerVat`, lib/seller-vat.ts:34-45):
  from acceptance, quotes and new sales use the new organiser's registration.
- The old organiser keeps seeing their past sales: purchase RLS lets a user
  see rows where `organiser_user_id = me` (purchase_ledger:52).

### (3) Main facilitator, rooms, meeting account

`meetingAccount` is the main facilitator if set, **else the organiser**
(lib/main-facilitator.ts:50-72). So:

- With a main facilitator set: nothing moves.
- Without one: the room account changes from the old organiser to the new.
  Rooms are stored per session (`meeting_url`), so accept runs
  `propagateRoom(oldRoom → newRoom)` for future `personal_room` sessions —
  exactly what the host-removal route does when the main facilitator leaves
  (thread.ts:2910-2961, `leavingOrg`), with its four guards
  (main-facilitator.ts:22-29) and its queued calendar changes.
- Sessions pinned to the old organiser (`room_owner_id`, or
  `meeting_account_user_id` = their user): kept as they are when
  `keep_as_host`; reset to the thread's account when not — the same rule the
  removal route applies to a leaving host.
- Zoom/Meet links MINTED on the old organiser's own account stay valid only
  while that account exists. v1 lists them on the request card ("3 future
  sessions use a Zoom meeting in Anna's account") and keeps them; re-minting
  is a later step.

### (4) Certificates

`issueCertificate` reads the organiser (or team) AT ISSUE TIME and freezes
`org_name` and `issued_by` into the snapshot (thread.ts:3443-3535); the
template carries no names (20260701090000:54-65). So issued certificates keep
the old name, and certificates issued after acceptance name the new
organiser. **Recommended: leave it** — "issued by" is who stands behind the
certificate when it is issued. Decision for Sjoerd if a cohort that ran
entirely under the old organiser should still name them.

### (5) Messages and calendar

- The sender of thread mail is the **workspace** (`workspaceSender`,
  lib/workspace-brand.ts:101-118) — unchanged.
- The `{organiser}` token is read at send time (thread.ts:8788-8796,
  8934-8942), so scheduled messages after acceptance name the new organiser;
  `{facilitator}` follows `meetingAccount` (main-facilitator.ts:388-420), see
  (3).
- Calendar invitations: `fromName` and reply-to are the current organiser
  (lib/calendar-invite.ts:495-513, 636-643); ORGANIZER is the platform address
  (540). Invites already sent keep the old reply-to until the next update;
  the subscription feed changes at once (lib/calendar-feed.ts:212-253).
- v1 sends participants **no** automatic message — the new organiser can send
  one. Decision for Sjoerd if participants should be told.

### (6) Hosts

`keep_as_host` defaults to **on**: the old organiser stays on the thread as a
`host` (thread_thread_organiser, role host|facilitator; nothing prevents the
thread's own organiser being a member, thread.ts:2822-2908). They keep seeing
it, their pinned sessions stay theirs, and "approval from the departing
organiser" does not have to mean "and lose sight of what you built". Off =
they leave the thread entirely (the second door defaults it off — they have
left the workspace).

If the new organiser was already a host or facilitator, their member row is
removed — they are the organiser now. If that row was the main facilitator,
`main_facilitator_id` nulls on delete (20261014190050:14) and the meeting
account becomes the organiser, i.e. the same person.

### (7) The payment check

`paymentRouteProblem` (lib/thread-payment-route.ts:99-160) depends on the
organiser's own Stripe account when `payment_destination = 'personal'`
(organiser user read at line 114), and on their default payment methods
(payment-accounts.ts:163-178). It takes a `pending` override for a save in
progress, with no organiser in it.

Proposal: extend `pending` with `organiserUserId`, and run it for the NEW
organiser at proposal (shown on the card) and again inside accept. **A paid,
live thread whose new organiser has no working way to take the money is not
accepted** — the new organiser is told what to connect (Settings → Payments)
and can accept once it works. Free threads, workspace-destination threads and
team threads paid to the lead pass unchanged. `paymentRouteSummary`
(183-245) labels the destination by comparing with the current organiser, so
it reads right after the switch without change.

## Also keyed on the organiser (checked, no action beyond the above)

- RLS on `thread_thread` checks workspace and app only (20260701090000:290-295)
  — no policy change.
- The organiser's public page and "organisations of a person" list threads by
  `organiser_id` (thread.ts:6518-6524, 6070-6076) — they move, by design.
- `public_root_slug` is the slug namespace, per organiser, not per thread
  (20260909210000:35-47) — untouched.
- Activity rows carry no organiser (thread.ts:4509-4516).

## Decisions for Sjoerd

1. Certificates issued after the handover name the **new** organiser
   (recommended), or the one the cohort ran under?
2. Tell participants automatically, or leave it to the new organiser
   (recommended for v1)?
3. Expiry of a request: **7 days**?
4. `keep_as_host` default **on** for the organiser door?

## Tests the build owes

- The accept function: wrong person, expired, already accepted, thread moved
  in between — each refused, nothing half-applied.
- An old personal-scope link answers `moved_to` the new owner; a team thread's
  link is unaffected.
- A refund of a pre-handover purchase — with and without a stored account —
  debits the OLD account; a sale after acceptance lands on the NEW one; a
  checkout opened before and paid after stays the old organiser's.
- A paid live thread to a new organiser without payments: proposal shows it,
  accept refuses.
- `propagateRoom` moves future personal-room sessions and leaves past ones.
