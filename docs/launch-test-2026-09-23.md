# soul.com launch test — 2026-09-23

The whole member flow, run on staging (`thefibre.tech`) the evening before
launch, by a fresh chat with the brief in the session memory. Staging only;
production was read for comparison and never written. Staging code was
v0.129.0 (`a1677ce5`), the staging API at v0.123.0.

**Verdict: the flow works end to end. One defect blocks a clean launch and is
already live on production; two are cosmetic.** Details in §4.

## 1. What was proven, and how

The fixture is the staging `default` workspace ("The Thread", join headline
"soul.com"), which already carried the two paid soul.com tiers and a Stripe
test connected account. Production's shape was read first and the fixture
was brought level with it through the admin screens, not the database:

| Step | Done through | Evidence |
|---|---|---|
| Tier "Cooperative Members", no price | Members → Tiers → New tier | row `f00e21d6`, `price_cents_year null` |
| Product "Community agenda" with a Thread grant | Members → Products → New product → Access → Thread → picker | grant `a77b1046`, `config.thread_slug = "year-agenda"` |
| Product included in all three tiers | Members → Tiers → edit ×3 | three `membership_tier_product` rows |
| Five cooperative members, comped, invited | Members → Add member → "Create … as a new contact" ×5 | five `person` + five `membership_member` rows, `membership_joined` activity each |
| Five invitation emails | — | "Your The Thread membership" ×5 in the inbox, each within 2 s of the save |
| Public join → Stripe Checkout | `POST /api/v1/membership/public/join` ×2 | two `cs_test_…` sessions; the Checkout page renders €300/year with card and Klarna, email prefilled |
| Paid join settles the membership | Stripe test clock, yearly subscription on the connected account carrying the join flow's metadata | `invoice.paid` → member `active`, `renews_at` +1y, ledger row `HABMCNNA-0005` with PDF, `membership_joined`, welcome + receipt emails |
| **Annual renewal** | test clock advanced one year | `subscription_cycle` invoice paid → `renews_at` 2028, `membership_renewed`, ledger row `HABMCNNA-0006`, renewal receipt email |
| Member portal | `membership.thefibre.tech/my` as the paying member | "Active · Renews on 23 Sept 2028 · Invoices (1) · Manage payment" |
| Thread annual agenda | the 5-minute scheduler, nothing clicked | all five cooperative members and every older active member enrolled in the `year-agenda` thread within one tick; visible on The Thread → Enrolments |
| Circle sign-in | spot-check only (verified in full on 2026-09-23 morning) | unknown client → 400 "Unknown application"; `/oauth/me` without a token → 401 |
| Staging Stripe webhooks | `verify-stripe-webhooks.mjs` | all four endpoints registered in the right mode, all events present |
| Staging smoke | `smoke-staging.mjs` | all green |

Left for Sjoerd, by design: the first paying member's Checkout (the test card
is typed by hand), on the session URL handed over in the chat.

## 2. The scheduler, observed

Every timed transition in the flow runs on the API's 5-minute tick, and the
test caught each one:

- Thread grants for six existing members synced at 13:34:06, thirty seconds
  after the grant was created; the first new member at 13:34:42; the next
  four at 13:39:22.
- The reminder path was exercised by moving Anna's `renews_at` to +10 days:
  the 13:44:22 tick wrote the dedup row and the email arrived one second
  later — "Your The Thread membership renews on 3 October 2026 … the renewal
  happens automatically", with no amount, since the tier has none. Note that
  a comped member receives this reminder at all; harmless, but worth a
  thought once item 1 in §4 is fixed and the date is a year out.
- The grace path was NOT exercised. Bram's `renews_at` was moved to −2 hours,
  but the sweep skips a row whose renewal date is not after its start date
  (the 2026-09-09 guard against grace-ing someone who just joined), and a
  member created tonight cannot be overdue without tripping it. The guard
  behaved as designed; the transition itself is covered by the integration
  pack.

## 3. Production, read for comparison

`soul` workspace `986d1631`: three tiers (Community €300, Fellowship €2300,
Cooperative Members unpriced), the "Community agenda" product with a `thread`
grant on `community-member-year-agenda`, a Google-user grant, three active
members (all manual, none on Stripe), nine granted journal rows, **no Circle
API token and no `oauth_client` row**. So on production today, joining
unlocks the year agenda and the Google account; Circle sign-in is not wired
and Circle sync cannot run.

## 4. Findings

1. **An unpriced tier renews monthly.** `add-member-dialog.tsx` derives the
   interval from the tier's prices: a tier with no yearly price falls to
   `month`, and the API then dates `renews_at` one month out. Every
   cooperative member added tonight renews on 2026-10-23; the overdue sweep
   will grace them then and lapse them fourteen days later, revoking the
   agenda enrolment. **Production has the same row**: the cooperative
   member added 2026-09-22 renews 2026-10-22. Fix: an unpriced (comped)
   tier should default to a year, in the dialog and as the API's fallback;
   and the existing production row needs its date moved. Workaround until
   then: set "Renews on" by hand when adding a cooperative member.
2. **The Members list did not show a new member after the first save** until
   a reload; later saves refreshed within the wait. Likely the
   `router.refresh()` race noted in CLAUDE.md. Cosmetic.
3. **React hydration warning (#418) on the Members page**, from the console,
   no visible effect. The 400s in the same console are Vercel's own
   `OPTIONS /` probe, not ours.
4. Nothing else. The invoice numbering, VAT-free amounts, seller block and
   period labels on both receipts read correctly.

## 5. Fixture left on staging

Workspace `default`: tier Cooperative Members, product Community agenda +
grant, members `sjoerd+coop1…5@soul.com` (comped), `sjoerd+community2@soul.com`
(Stripe test clock `clock_1UIqP6LHO1HI5S0RNxNXu6pp`, subscription
`sub_1UIqP8LHO1HI5S0R1ywF5Mks`, now in its second year) and
`sjoerd+community1@soul.com` (person + auth account only, Checkout open).
Anna's and Bram's `renews_at` were moved for §2. The test clock was left in
place so the member row keeps a live subscription behind it; deleting the
clock deletes the customer and subscription in Stripe.
