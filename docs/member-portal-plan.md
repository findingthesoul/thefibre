# One place for a member

_Written 2026-09-09, from Sjoerd's brief: "As a user, I want 1 environment
for everything… Not different places."_

---

## 1. The problem, measured

There are **three** member-facing pages in the family today, not two. Each
grew where an app happened to need one.

| Address | What a member finds there |
|---|---|
| `my.thethread.app` | tickets, threads, meets, memberships, invoices |
| `membership.thethread.app/my` | memberships, invoices, product purchases, manage payment |
| `app.thethread.app/my` | thread enrolments only |

A member therefore has to know **which app sold them the thing** in order to
find it. That is an internal fact about our architecture, leaking into the
one surface that should know nothing about our architecture.

None of the three had a way to sign out until v0.68.55.

**`my.thethread.app` is already the closest to the target** — it was built to
be the single place — so this plan finishes it and retires the other two into
it. We are not building a fourth.

---

## 2. What the page is for

One sentence, and every decision below defers to it:

> **A member opens this to answer "what do I have, and what is next?" —
> standing up, on a phone, often with two minutes and one hand.**

Three consequences that decide most of the arguments:

- **Only the information you need, but all of it.** A card at a door needs the
  date, the time, the place and the ticket. It does not need the description,
  the organiser's biography or the refund policy. Those live one tap deeper.
- **Time is the spine, not our app names.** "What is next" is a chronological
  question. Grouping by workspace answers "what does soul.com hold for me",
  which is a question nobody asks.
- **Nothing here is administration.** No settings pages, no preferences, no
  workspace switching. A member has one identity and one list.

---

## 3. Information architecture

Sjoerd's brief lists seven things. Seven destinations is a menu; four is a
page you can hold in your head.

```
  NEXT          everything with a date, soonest first
                thread sessions · meets · (past behind one toggle)

  MEMBERSHIPS   what you belong to, and what it unlocks

  PURCHASES     every invoice, across everything

  YOU           your details, and sign out
```

**Why memberships are not in Next.** A membership has no date; it has a
state. Putting it in a chronological list means inventing a position for it.

**Why purchases are their own place and not inside each membership.** A
member buys thread tickets, meet bookings, one-off products and memberships.
Money asked about later is asked about as money — "what did I pay" — not
"which of my four memberships was that under". Membership detail links INTO
the list, filtered.

**Why "past" is a toggle and not a fifth destination.** Past events are
looked at rarely and briefly, usually for a certificate or a receipt.

---

## 4. Mobile first

The phone is the real device. Design here, then let the desktop have the
room it has.

### Chrome

**A bottom tab bar** with the four destinations. `@thefibre/shared/ui/bottom-nav`
already exists and ships in all six apps — apps/my does not use it yet, and
should. Four tabs fit without a More sheet; that is a reason to keep it at
four.

No sidebar. No top bar beyond a title.

### NEXT — the home

One card per thing, ordered by date, soonest first.

```
┌─────────────────────────────────────┐
│  5    Conversation 1            ▸   │
│  JAN  16:00 · soul.com              │
│       [ Join ]                      │
└─────────────────────────────────────┘
```

Four facts and at most one action: **date chip, title, time and organiser,
and the single action that matters right now** — Join for something virtual
starting soon, otherwise nothing. Everything else is a tap away.

The date chip on the left is what the eye scans. This is already proven in
the detail popup (v0.68.51) and should govern the list too.

**Tapping a card opens the detail sheet** that already exists: check-in code,
agenda, RSVP, add to calendar. Extended with participants and documents.

**Past** is a single control at the bottom of the list — "Earlier" — that
reveals the same card shape below it.

### MEMBERSHIPS

One card per membership: community, tier, state, renewal date. Tapping opens
what it unlocks — the products, with working links to each — plus a line
through to that membership's invoices, and the payment-method control where
one applies.

### PURCHASES

One list, newest first: what it was, how much, paid or outstanding, and a
download. `@thefibre/shared/ui/invoice-dialog` and `invoice-model` already
render exactly this on the organiser side; the member side must use the same
components so an invoice looks like the same document to both parties. The
PDF goes through `createInvoicePdfRoute`, which already takes an `apiPath`.

### YOU

Name, email, language. `@thefibre/shared/ui/profile-form` exists. Sign out at
the bottom — `@thefibre/shared/ui/sign-out`, shipped v0.68.55.

### Rules that apply to every screen

- Every tappable thing is at least **44px**. Measured and enforced twice
  already on this surface (v0.68.38, v0.68.51).
- Nothing scrolls horizontally at 375px.
- A destination that is empty says so in a sentence. An empty list and a
  missing feature look identical, and that confusion has already cost an
  evening once.

---

## 5. Then desktop

The desktop is the same information with room, not a different product.

- The bottom bar becomes a **left rail** with the same four entries.
- **Two columns** on Next: the list on the left, the selected thing's detail
  on the right instead of a sheet. The sheet's content is unchanged; only its
  container differs.
- Lists gain the columns a phone had no width for: organiser on Next, amount
  and status inline on Purchases.
- Nothing appears on desktop that is absent on mobile. If it did not earn a
  place on the phone, it is not needed.

---

## 6. What we build on

Almost all of it exists. **Reach for these before writing anything:**

| Need | Use |
|---|---|
| Tab bar / rail | `ui/bottom-nav` |
| Invoice row + detail | `ui/invoices`, `ui/invoice-dialog` |
| What an invoice IS | `invoice-model` |
| Invoice PDF download | `invoice-pdf-route` (`apiPath`) |
| Personal details form | `ui/profile-form` |
| Sign out | `ui/sign-out` |
| Sheets and dialogs | `ui/dialog` |
| Lists | `ui/list`, `ui/page` |
| Explaining a control | `ui/info-hint` |
| Calendar file | `ical` |
| Buttons, dates, selects, toasts | `ui/button`, `ui/date-field`, `ui/search-select`, `ui/toast` |

**The rule, unchanged:** if a surface here needs something a second app will
also want, it is born in `@thefibre/shared` with the app-bound pieces
injected. Never a per-app fork.

---

## 7. What the API still owes

`GET /api/v1/me/portal` already returns tickets, threads, meets, memberships
and agenda items grouped **by workspace**. The gaps:

1. **A chronological view.** Either the payload grows a flat, date-sorted
   list, or the client flattens what it already fetches. Decide before
   building Next — it determines whether the organiser filter is a query or
   a client-side predicate.
2. **Participants on a thread**, consent-gated. `share_participants_participants`
   already governs this on the public side; reuse that rule, do not invent a
   second one.
3. **Documents and other engagement content.** `external_url` is already in
   the agenda payload; what is missing is the non-agenda material.
4. **Invoices beyond memberships.** Membership invoices have an endpoint
   (`/membership/portal/me/invoices`). Thread and Meet purchases do not have
   a member-facing equivalent yet.
5. **Personal details, read and write**, email-scoped like everything else
   here.
6. **Meet reschedule** for a member. Exists for a host; not for the guest.

---

## 8. Build order

Each slice stands alone and is worth shipping on its own. Mobile first
throughout; desktop follows in the same slice, not in a later one.

**0 · Sign out.** Done (v0.68.55). One import for the other two pages.

**1 · The shell.** Done (v0.68.57). Four tabs, `ui/bottom-nav` below `md`
and a local rail above it. The existing content moved into NEXT unchanged;
memberships and invoices moved out to their own tabs, so all four
destinations are real on day one rather than three placeholders.

**2 · NEXT as a timeline.** Done (v0.68.59). One date-ordered list, date chip
first, RSVP or Join on the card, past behind an "Earlier" toggle, organiser as
a filter that only appears when there is more than one. Flattened in the page,
not the API — the open decision below, decided.

A thread with dated sessions contributes its SESSIONS, not itself: a session
is what you attend, a thread is the container, and a container has no place
in a list of things that happen. A thread with nothing scheduled still
appears, on its own start date.

**3 · PURCHASES.** The shared invoice components against the endpoints that
exist. Membership invoices work today; Thread and Meet need theirs.

**4 · MEMBERSHIPS.** What it unlocks, with links; through to its invoices;
payment method where applicable. This is where `membership/my` earns its
retirement.

**5 · YOU.** Details plus sign out.

**6 · Retire the other two.** `membership.thethread.app/my` and
`app.thethread.app/my` redirect to `my.thethread.app`. **Not before parity** —
a redirect that loses something is worse than two pages.

**7 · The deeper thread content.** Participants and documents, once the shape
has been used for a while.

---

## 9. Open decisions

- ~~**Flatten in the API or the client?**~~ Decided in slice 2: **the page**.
  Everything is fetched in one call and one member has few entries. The
  organiser filter is therefore a client-side predicate. Move it server-side
  when a real member's list is long enough to hurt.
- **The two kinds of date needed one rule and now have one.** Some entries
  carry a day, some a clock. An all-day entry sorts at the START of its day
  and stays until the day is over; a timed one stays for two hours after it
  starts, so something happening RIGHT NOW is still the top of the list.
- **Do past events expire?** The payload has a 90-day window for meets today.
  A certificate from two years ago still matters.
- **Does a member need a workspace filter at all** if the list is short? Add
  it when a real member has enough entries to need one, not before.
- **What does a member see of other participants**, and does the organiser
  choose per thread or does the participant choose per enrolment?

---

## 10. How we will know it is right

Not by a green build. This surface has produced two live bugs, one
half-true claim and one wrong-layer keyboard bug, none of which any gate
caught, because all of them live behind a session.

**Every slice gets driven signed in, on a phone-sized viewport, against the
staging fixture** (`portal-verify@thefibre.tech`). The fixture has already
paid for itself seven times in one evening. It currently proves a thread, a
ticket, an agenda item and RSVP; it does **not** yet prove a membership or an
invoice, and slice 3 or 4 should start by fixing that.

### How to sign in as the fixture

`localhost:3007` is **not** in staging Supabase's redirect allowlist, so the
magic link an admin `generate_link` produces comes back pointed at
`thefibre.tech` and is useless locally. The eight-digit code path does not go
near that allowlist, and `generate_link` hands you the code in plain text:

1. Point `apps/my/.env.local` at staging (Supabase URL + anon key from
   `apps/api/.env.staging`, API at `thefibre-api-staging.fly.dev`). Back the
   file up first and restore it afterwards — it normally points at
   production.
2. In the app, enter the fixture address and ask for a code. The email itself
   goes nowhere; the request is only there to put the form in its code state.
3. `POST {staging}/auth/v1/admin/generate_link` with the service-role key and
   `{"type":"magiclink","email":"portal-verify@thefibre.tech"}`. The response
   carries `email_otp` — that is the current code, and it supersedes the one
   step 2 minted.
4. Type it in.

Verified end to end on 2026-09-10, including sign-out and signing back in.
