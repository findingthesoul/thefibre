# Membership: a team's calendar, a member discount, and a seat in a team

Design note, 2026-10-12. Not a proposal to build yet — it names the shape and
the three decisions that are Sjoerd's. Two further questions it raised were
settled by the controller and are recorded as settled, not open.

---

## First: do not re-mean the `thread` grant

The brief says the `thread` access-grant kind "is offered and has no worker —
the open hole". **That was true until 2026-09-09 and is not true now.**
`apps/api/src/lib/thread-access.ts` drains it, and I checked both stacks
rather than reading the code alone:

| | staging | production |
|---|---|---|
| `thread` grants | 1 | **2** |
| their journal rows | 14 | **12** |
| rows not `granted` | 0 | **0** |

So two live production grants are delivering, twelve members have been
enrolled through them, and nothing is stuck. The config key is `thread_slug`:
it means *"auto-enrol this member into THIS ONE named thread"*.

"A team's whole calendar, opt-in" is a **different promise** — different
config, different cardinality, different moment of action. Re-meaning `thread`
would silently change what those two tiers deliver to people who already
bought them, and `thread_slug` would become meaningless config nobody
migrated.

**So: a new kind, `team_calendar`. `thread` keeps its meaning and its worker.**

This also answers the brief's last question — *what happens to the existing
`thread` journal rows that were never drained?* **There are none.** Every row
on both stacks is `granted`. The question was built on the stale premise.

---

## `team_calendar` — the shape

Sjoerd, 2026-10-12: *"another membersjip access thing could be: give default
discount to threads from the community you're part of."*

That is the same grant with a dial on it, not a second kind:

```jsonc
// membership_access_grant.config
{ "team_id": "uuid", "discount_pct": 100 }
```

`100` is the calendar-B case — the member joins for nothing. `20` is a
standing member discount. One kind, one mechanism, and no second code path
that only runs at one end of the range.

**Settled** (controller, 2026-10-12, not needing Sjoerd's attention):

- `discount_pct` **defaults to 100**, and the field is labelled *"100% — free
  for members"* rather than shown as a bare percentage box. Somebody has to
  type the number, and a stray 0 would promise a calendar that charges full
  price.
- **0 is refused.** A 0% grant is a no-op that still appears in the product as
  a promise — exactly the failure this kind already had once, when `thread`
  was offered with nothing behind it. If a tier should not carry the calendar,
  drop the grant; do not grant nothing. Validate it where the grant is
  written, not only in the form, so the API cannot be used to store one.

One grant, one team. Not a list: a tier that includes two teams' calendars is
two grants, which keeps "what does this product promise" readable as rows.

**It has no worker, and that is the design.** Every other kind provisions
something at a lifecycle moment — a seat, a Circle account, an enrolment. This
one grants *permission to join later*, so there is nothing to push at grant
time. The journal row goes straight to `granted` on grant and `revoked` on
revoke, and the work happens when the member actually presses Join.

That makes the membership→thread direction **a read, not a sync** — which is
the part worth getting right, because a sync that silently does nothing is the
bug this very grant kind already had once.

## Where the check lives — and why it must not compute a price

One exported function, in `apps/api/src/lib/thread-access.ts` beside the
existing worker. It answers *entitlement*, not money:

```ts
memberDiscountFor(personId, threadId) → { pct: number, via?: grantId } | null
```

**It does not calculate anything.** That is the whole of point (d), and the
existing code makes it easy, because the thread price path is already built
the right way:

- `couponPrice(coupon, baseCents)` is a **pure function** (thread.ts:6598).
- `findValidCoupon()` is **already shared** by the enrol form's "Apply" and
  the enrol POST — the comment on it says *"never trust the client's price"*.
- The POST settles it in one line: `coupon ? couponPrice(coupon, base) : base`
  (thread.ts:6906), after choosing the ticket and before deciding
  `requiresPayment`.

So the member discount joins **that** line, as one more input to one
calculation:

```ts
enrolmentPrice(baseCents, coupon, memberPct)
  → { cents, reason: 'full' | 'coupon' | 'membership' }
```

Called by the public page to show a price, by `POST /enrol` to charge one, and
by `/my` to label a thread as included. Three callers, one function, one
answer. A second calculation anywhere here is the offer-versus-enforcement bug
with a longer fuse: the page would promise a member price and the POST would
charge the list price, and the first person to notice would be a member.

### (a) With a discount code: best of the two, never stacked

The better of `couponPrice(coupon, base)` and `base × (1 − pct/100)` wins, and
the `reason` says which. Stacking is the wrong default — a 30% member
discount plus a 50% code is not an offer anybody made, and the person who
discovers it will not be the organiser. **Best-of is still generous**: a
member never does worse by holding a code, and never worse by being a member.

### (b) Per-ticket prices: the percentage applies to the chosen ticket

The POST already resolves a ticket before any discount — it picks the chosen
one, or the cheapest open one, and takes `price_cents` from it. The member
percentage applies to that resolved base, exactly where the coupon applies.
Nothing ticket-aware needs adding; it needs *not* bypassing.

One asymmetry to keep deliberately: a coupon may be **scoped to one ticket**
(`thread_coupon.ticket_id`) and a membership discount is scoped to a **team's
threads**, so it applies to whichever ticket the person picks. That is the
right shape — the membership is a relationship with the community, not with a
price row.

### (c) The ledger records what was paid, and why

The purchase row carries the amount actually charged plus the reason and the
grant id. Then **the €0 question stops being special**: it is the 100% case of
a rule that also covers 20%, and the ledger answers *"why was this €7 and not
€35?"* without anybody reconstructing it from a tier definition that may since
have changed.

This does not decide the parked question of **whether** a €0 enrolment writes
a purchase row at all — see the decisions below. It does mean the answer
should be the same for a €0 member join and a 100%-off coupon, because by then
they are the same code path with a different `reason`.

It resolves: active membership → its tier's products → their grants → any
`team_calendar` whose `team_id` matches the thread's `team_id`. Active means
the same predicate the rest of membership uses; it must not be re-derived
here, or the two will disagree about the day a membership lapses.

**When the membership ends**, `memberDiscountFor` starts answering null. New
joins stop; existing `thread_enrolment` rows are untouched, because the
platform rule is soft-delete-only and a record of taking part is not something
a lapse should erase. That matches what the brief asked for and what
`thread-access.ts` already does on revoke.

## /my

`apps/my/app/you/calendar-card.tsx` lists what the person is enrolled in. A
member's "calendar B" is **not** a new data source: it is the same list, since
joining writes the ordinary `enrolment` + `thread_enrolment` pair. What is new
is a section for what they *could* join — the team's published, future threads
they have not joined yet, each showing the member price from the same
function — so what is listed and what it costs cannot disagree. Nothing is
auto-enrolled, as asked.

---

## The seat that lands in a team

`fibre_seat` gains `{ "team_id": "uuid" }` in its config. The seat is created
as today; the team is an additional membership.

**The Everyone interaction is the thing to check before building.** From
`automatic-teams.ts`: *"Everybody in this workspace. New members join
automatically, and the apps granted here are what a newcomer gets."* So a
granted seat is **already** in Everyone and already has Everyone's apps. The
chosen team is therefore additive — it cannot be used to give someone *less*
than Everyone gives. If a tier is meant to confer narrower access than the
baseline, that is not a team choice, and saying so now avoids building a
control that cannot do what its name implies.

### How a team actually confers an app — checked

`team_app_grant` is the INTENT; `app_membership` is the ENFORCEMENT point; and
`apps/api/src/lib/team-grants.ts` is **the single writer** of `app_membership`
for grant changes, so there is never a second opinion about who may open what.

Two rules there look similar and are not, and the difference decides how this
feature behaves at both ends:

- **Resolution is a UNION.** Effective apps are every app conferred by every
  active team the person is an active member of, plus the direct grants an
  admin ticked. Nobody loses an app by *joining* a team. This is what makes a
  team choice additive and confirms it cannot confer less than Everyone.
- **The sync is a RECONCILIATION.** `syncUsers` deletes any `app_membership`
  row that is no longer wanted. So *leaving* a team does remove app access —
  union on the way in, reconciliation on the way out.

Three consequences for the seat-with-team work:

1. **Placing the seat in a team is not enough.** `fibre-seat.ts` must call
   `syncUsers([userId])` (or `syncTeam`) afterwards, or `app_membership` is
   never recomputed and the seat sits in a team that confers nothing — the
   silent-no-op shape this area has produced before.
2. **Lapse is asymmetric, on purpose, and should be stated to Sjoerd.** A
   lapsed membership leaves thread enrolments standing (soft delete only, a
   record of taking part) but *does* take the app access away, because the
   team membership goes and the reconciliation follows. Both are right; they
   look inconsistent if nobody says why.
3. `fibre-platform` is explicitly skipped by the sync — granted by the
   platform itself, never ours to remove. Anything built here inherits that
   and should not special-case it again.

Still unanswered, and cheap to answer when building: what happens when the
named team is later deleted, and what happens when a seat is revoked while the
person is in that team for another reason. The union rule suggests the second
is safe — they keep the app via the other team — but I have not run it.

---

## Decisions for Sjoerd

1. **Does a €0 enrolment write a purchase row at all?** Open, and deliberately
   not decided here — it is the question already parked as *"€0-with-code
   enrolments in the ledger?"* in `docs/build-plan.md`. Once the member
   discount goes through the same calculation, a €0 member join and a
   100%-off coupon are the same code path with a different `reason`, so they
   must get the same answer. Everything above €0 is settled: the row records
   what was paid and why. Only the zero case is open.
2. **Does a team's calendar mean its published threads only, or all of them?**
   Published is the safe reading and the one I would build. Worth confirming,
   because an unpublished thread is a draft and including it would show
   members things that are not ready.
3. **Should a lapsed member see the calendar they can no longer join?** Listing
   it is a nudge to renew; hiding it avoids dangling something they cannot
   have. Either is defensible; it is a judgement about how the end of a
   membership should feel.

**Already answered, recorded so nobody reopens them.** The asymmetry at lapse
— joined threads stay, the seat's app access goes — was put to Sjoerd and
rides on his "membership as recommended"; it is a deliberate choice, not an
oversight. And the two above were settled by the controller rather than spent
on his attention: default 100, and 0 refused.

## What I checked, and what I did not

Checked: the grant table and config shape; that `thread` has a worker and is
draining on both stacks (counts above); the Everyone team's description in
`automatic-teams.ts`; that `thread-access.ts` leaves rows on revoke.

Also checked, after the first draft: how a team feeds `app_membership` —
`team-grants.ts` is its single writer, resolution is a union, and `syncUsers`
reconciles by deleting what is no longer wanted. That turned one inference in
this note into a mechanism, and added the lapse asymmetry above.

Checked for the discount: `couponPrice` is pure (thread.ts:6598);
`findValidCoupon` is already shared by the form's Apply and the enrol POST;
the POST resolves the ticket, then applies the coupon in one line
(thread.ts:6906), then derives `requiresPayment` from the result. That is why
the member percentage can join an existing calculation instead of starting a
second one.

Not checked: what the public thread PAGE renders today from that price, so
"the offer calls the same function" is a requirement here rather than a
description of a change I have scoped; the `/my` query's shape beyond the file it lives in; and the
two team-lifecycle cases named at the end of the seat section.
