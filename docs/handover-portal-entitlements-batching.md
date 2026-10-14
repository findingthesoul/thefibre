# Handover: batching the team-calendar entitlements walk

Written 2026-10-14, at the end of the session that measured my.thread's
performance. This is the one remaining item from that measurement, and it is
the only one that touches **code that decides what somebody is charged** — so
it was deliberately not started at the end of a long session.

Do the three steps in order. The third one is the change; the first two are
what make it safe to delete the old path.

## What is slow, and why

`GET /api/v1/me/portal` is the heaviest call in my.thread, and it is the
**floor for every page**, because every page calls `loadSession()` and that
fetches the portal.

Measured on staging, 2026-10-14, three runs with a fixture session:

| endpoint | median |
|---|---|
| `/me/portal` | **808ms** |
| `/me/portal/erasure` | 576ms (now streamed, v1.191.1) |
| membership `/portal/me/directory` | 404ms |
| `/me/portal/calendar` | 98ms |
| `/me/profile` | 91ms |

**That 808ms is for a fixture holding NO memberships.** It is the floor, not
the typical case — which is the whole point of this item.

The loop is in `apps/api/src/lib/could-join.ts`:

```ts
for (const m of members) {
  if (!m.person_id) continue;
  entitlements.set(m.id, await teamCalendarEntitlements(m.person_id, m.workspace_id));
}
```

`teamCalendarEntitlements` (in `apps/api/src/lib/member-discount.ts`) makes
**three queries per call** — the membership row, the tier's products, the
person's bought products — and then `teamCalendarsCarriedBy` adds one or two
more. So a member of two communities pays six to ten sequential round trips
that could be two or three, and a member of five pays five times that.

## Step 1 — a fixture that holds two memberships

**Nothing in the repo has one**, which is exactly why the measurement above
shows the loop doing nothing. Without this there is no before-and-after to
report, and the number everybody wants is the one that cannot currently be
produced.

- The e2e fixture account is `e2e-fixture@example.com`, in workspace
  `e2e-fixtures` (`e2e/identities.ts`, `E2E_FIXTURE`). It holds **no**
  membership, deliberately: *"NO community is seeded: the slice that needs one
  seeds its own."*
- So seed one in that style — two memberships in two workspaces, each tier
  carrying a `team_calendar` grant, at least one of them reached through a
  PRODUCT rather than the tier, because that is the shape soul.com actually
  has and the shape the tier-only lookup used to miss.
- Follow the rules the hard way round: a **permanent** fixture workspace with
  content cleared per run, never a workspace created and deleted — `activity`
  is append-only even against the service role, so a workspace that ever hosted
  a paid join can never be hard-deleted. `apps/api/scripts/stress-webhook-shapes.mjs`
  has the permanent-fixture pattern (`int-webhook-shape-fixtures`).

Timing harness, already written and working — no browser needed:
`admin/generate_link` for the fixture email, then `POST /auth/v1/verify` with
the `token_hash`, which returns an access token directly. **The admin API
returns `hashed_token` at the TOP level, not under `properties`**, which the
client library's typings imply; that cost two attempts. The script from this
session is in the session scratchpad as `time-you-tab.mjs`; it is twenty lines
and worth rewriting into `apps/api/scripts/` if this is done more than once.

Record `/me/portal` BEFORE the change, three runs, with that two-membership
fixture. That number is the point of the exercise.

## Step 2 — the equivalence test, BEFORE deleting anything

Required by the coordinating session, and right:

> for a person with two memberships, the batched walk returns EXACTLY what the
> old per-member walk did — entitlements, pcts **and** `via` — before you
> delete the old path.

`via` matters as much as the percentage: it is the grant id a surface uses to
say *which* promise a price came from, and a batched query that returns the
same percentages through different grant ids would pass a careless test and
produce a wrong answer to "why was this €7?".

Note the existing tie-break, which the batched version must preserve: **the
best percentage wins per calendar**, because a tier can carry the same calendar
twice through two products, and taking the first would make the price depend on
row order. There is a test for that in `packages/shared/src/price-logic.pick.test.ts`
in spirit, and the rule itself is commented in `teamCalendarsCarriedBy`.

Keep both paths alive while the test runs. Delete the old one only once the
test passes with two memberships AND with one AND with none.

## Step 3 — the batching

Shape: one query per SOURCE across all memberships, rather than three per
membership.

- all tier grants for the set of tier ids, in one `.in('tier_id', [...])`;
- all `membership_tier_product` rows for those tiers, in one call;
- all product grants for the resulting product ids, in one call;
- the person's paid purchases once (it is already person-scoped, not
  membership-scoped — `teamCalendarEntitlements` re-asks it per member today).

Then resolve per membership in memory, with the same best-percentage rule.

## What NOT to change while in there

- `teamCalendarsCarriedBy` has a deliberate split from
  `teamCalendarEntitlements`: the latter gates on an active/grace membership,
  the former does not, because the welcome email asks what a membership
  INCLUDES moments after the row is written and a status gate there is a race.
  Keep the gate above the walk, not inside it.
- The certificates read in `routes/portal.ts` genuinely needs the enrolment
  ids. That one is a dependency, not an accident, and is correctly sequential.

## Still unverified, for whoever picks this up

Nothing in my.thread has been **seen signed in** — not the loading skeleton
(v1.191.0), not the "Your products" section (v1.189.0), not the streamed
erasure section (v1.191.1). All built, typechecked and unit-tested; none of it
looked at by a person. If a staging round has happened since, read its result
before trusting any of the above.
