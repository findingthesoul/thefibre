# The visitor portal — proposal

**Status:** D1, D2, D3 decided 2026-09-08. **API slice built and verified**
(uncommitted). Portal surface + PWA + door capability still to come.
D4, D5 open.
**Date:** 2026-09-08
**Author:** Claude (visitor-app session)
**Supersedes nothing.** Extends the `/my` pattern that already exists twice.

---

## 0. Why this document exists

Sjoerd, from the brief for this session:

> In V3 of the Thread we had an app for visitors of an event. In their account
> they could see the threads they were part of. Now we maybe need a landing
> page (login) where they have: tickets to threads (quick scan), threads they
> are part of with agenda and links, meets they have, memberships they have.
> All organised per organiser, if they have more. Login is email + code…
> simple. Is it good to make a PWA? And for facilitators a very simple QR
> scanner of the guest list.

Most of that is already built. This document separates what exists from what
is genuinely missing, and puts five decisions in front of you.

---

## 1. What already exists (do not rebuild)

| Asked for | Status | Where |
|---|---|---|
| Facilitator QR scanner over the guest list | **Shipped v0.68.6** | `apps/thread/app/(app)/threads/[id]/checkin/door-list.tsx` |
| Ticket with a scannable QR | **Shipped** | `apps/api/src/lib/checkin.ts`, `thread_enrolment.checkin_code` |
| Apple Wallet + Google Wallet passes | **Written, inert** | same file — env-gated on issuer accounts only Sjoerd can create |
| Login by email + 8-digit code | **Shipped** | Supabase OTP; `apps/thread/app/sign-in-button.tsx` |
| Threads I'm part of | **Shipped, Thread-only** | `apps/thread/app/my/page.tsx` → `GET /api/v1/thread/public/my-enrolments` |
| Memberships I have | **Shipped, Membership-only** | `apps/membership/app/my/page.tsx` → `GET /api/v1/membership/portal/me` |

The door scanner is worth describing, because it is better than "very simple"
and you may have forgotten what landed: live camera decode, the verdict written
full-screen in colour so it reads at arm's length with the phone half-turned
toward the guest, haptic buzz (one pulse admitted, three refused), a
repeat-scan guard so the same code doesn't re-fire for 4s, a name-search
fallback for people who lost their ticket, big tappable rows, a running count,
and undo on a mistaken tap. Times render in the *event's* timezone.

## 2. What is genuinely missing

1. **Meet has no visitor surface at all.** A booking reaches the guest as an
   email and a calendar invite and lives nowhere they can return to.
2. **Three doors, not one.** `thread.thethread.app/my` and
   `membership.thethread.app/my` are separate pages on separate subdomains with
   separate API routes. A visitor has to know which app their thing lives in —
   which is exactly the knowledge a visitor doesn't have.
3. **No per-organiser grouping.** The thing that makes it feel like *their*
   account rather than four products' accounts.
4. **The ticket is only in the email.** Delete the email and you are on the
   door volunteer's search fallback. The QR exists at a public URL; nothing
   shows it to its owner.
5. **The door page requires workspace membership.** It sits under `(app)` and
   calls `apiFetch`, so RLS demands a workspace member with access to that
   thread. Facilitator is a *per-thread* role. A volunteer on the door tonight
   is not a workspace member — and shouldn't have to become one.

Item 5 is the real facilitator gap. The scanner is done; who may hold it is not.

---

## 3. Decisions

### D1 — Does the portal cross the data wall? **Recommend: yes, and say so out loud.**

A portal showing threads + meets + memberships reads three apps' schemas in one
response. Brief §2 forbids apps reading each other's data.

This is not that. The wall stops *apps* reaching sideways. Here the **platform**
composes, on behalf of the data subject, a view of that person's own data —
GDPR Article 15 territory. The app-owns-its-content rule is intact; no app
gains a new read.

I recommend writing this into the brief as the **third sanctioned crossing**,
beside the `activity` log and the purchase ledger, so nobody later reads
`routes/portal.ts` as a violation and "fixes" it.

> **DECIDED 2026-09-08 (Sjoerd): accepted.** One platform route,
> `GET /api/v1/me/portal`, recorded in the brief as the third sanctioned
> crossing. Not four client-side app fetches.

### D2 — Where does it live? **Recommend: its own surface.**

Three options:

| Option | For | Against |
|---|---|---|
| **(a) `apps/thread/app/my`, extended** | Zero new infrastructure; the page exists | Puts meets and memberships under the Thread's roof. A visitor with only a membership lands on a thread-branded page. Also collides with the i18n session's lane tonight. |
| **(b) A new surface, `my.thethread.app`** | Honest: it belongs to no app, it belongs to the person. Own manifest, own PWA scope, own icon | An eighth deploy target; another Vercel project |
| **(c) `apps/web` (Fibre)** | Platform-owned, matches D1 | Fibre is backstage per the branding pivot; visitors must never see it |

I recommend **(b)**. The moment this shows meets *and* memberships *and*
tickets, "Thread" is the wrong parent — and per the branding pivot the public
name is THE THREAD anyway, so `my.thethread.app` reads right to a visitor while
staying architecturally neutral.

The domain/branding session has reviewed this and raises no objection from
their side: the five app subdomains are already A records at TransIP pointing
at Vercel, so this costs an eighth Vercel project, one A record, and a CORS
entry. Their one condition, which I'd adopt regardless: **register the surface
in `packages/shared/src/branding.ts` APPS rather than hardcoding any URL.**
That registry was the single change point that made the thethread.app domain
flip painless, and it hands us `appUrl` / `crossAppHref` for free.

If you'd rather not add a deploy target tonight, **(a) with leaf-file
discipline** is the cheap path and can move later; the API is identical either
way.

> **DECIDED 2026-09-08 (Sjoerd): `my.thethread.app`.** Its own surface.
> `apps/thread/app/my` therefore stays untouched and the leaf-file arrangement
> with the i18n session is not needed.

**Registration — one correction to the plan.** The branding session offered
either an `APPS` entry or a parallel registry entry. It must be the **parallel
entry**, because `APPS` is `Record<AppId, AppBrand>` and `AppId` is the app
*catalogue* vocabulary: `public.app` slugs, `X-App-ID`, `app_membership`,
`workspace_app` activation, the organiser launcher built by
`apps/*/lib/available-apps.ts`, `APP_DISPLAY_ORDER` (whose `indexOf` sort puts
an unlisted id *first*), and `TILE_FILES`.

The portal is not an app. It has no activation, no membership, no `public.app`
row, and it sends `X-App-ID: fibre-platform` like every other platform surface.
Giving it an `AppId` would teach the catalogue about something that isn't an
app — adjacent to the "hardcode which apps exist" failure the v0.14.0
open-catalogue work deliberately removed.

### D3 — What is an "organiser"? **This needs your ruling.**

"Organised per organiser" assumes one concept. There are three:

- **Thread** groups under `thread_organiser` (a person with a slug and a
  display name) and optionally a `team`.
- **Membership** groups under `workspace`.
- **Meet** groups under a **host** (a user with a slug).

For EBBF running threads, memberships and intake calls, the visitor should see
**one** "EBBF" card, not three. All three concepts hang off a workspace, so:

**Recommend:** group by **workspace**, labelled with the workspace's public
display name, and show the organiser/host as a sub-line inside the card where
it differs. Group by workspace, *label* by brand.

> **DECIDED 2026-09-08 (Sjoerd): group by workspace.** "Organiser in the eyes
> of the visitor can be workspace."

This settles more than the grouping key. It means the portal's top-level
structure is a **platform** concept, not any app's — which is the same reason
D1 resolves the way it does. Thread's `thread_organiser`, Meet's host and
Membership's workspace all hang off a workspace, so one EBBF card can hold a
ticket, a journey, an intake call and a subscription without any app knowing
about the others. The organiser or host name appears as a sub-line inside the
card where it differs from the workspace's own name; the visitor never has to
learn that "organiser" means three different things underneath.

### D4 — Is a PWA good? **Recommend: yes, thin, and second.**

**Do the wallet passes first.** For the ticket specifically, Apple/Google Wallet
beats a PWA on every axis that matters at a door: offline by default, updatable
by push, and it lives where people already look for tickets. The code is
written. It is blocked on an Apple Pass Type ID certificate and a Google Wallet
issuer account — both only you can create.

**Then a thin PWA**, for three things a web page cannot do:

- **Home-screen icon** — the "app" feeling with no store, no review, no second
  codebase.
- **Offline ticket** — a service worker caching the visitor's own QRs. Venue
  basements have no signal and conference wifi collapses at the door.
- **The scanner installs** — full-screen, no browser chrome eating the
  viewport, camera permission remembered between sessions.

**What I would not build:** an offline-first rewrite. Manifest, icons, and a
narrow service worker caching the portal shell plus the visitor's tickets.
Roughly a day, and reversible — a PWA that nobody installs is just a website.

Two caveats to design around, not discover later:

- On iOS, installation is manual (Share → Add to Home Screen). Without a
  visible hint, essentially nobody installs. Budget for the hint.
- On iOS, push notifications only work *after* installation. Do not promise
  "we'll notify you" on the pre-install page.

**Offline check-in** (queue scans, sync on reconnect) I recommend deferring:
it needs genuine conflict handling — two volunteers, two phones, one guest —
and the online path already works.

**Accept / reject:**

### D5 — Who may hold the scanner? **Recommend: a per-thread door capability.**

Today the door needs workspace membership. Options:

- **(a)** Make volunteers workspace members — wrong; grants authority over
  everything, forever, for one evening at a door.
- **(b)** Grant on the existing per-thread facilitator role — right shape,
  but facilitators aren't always the people on the door.
- **(c)** A per-thread, expiring **door link** the organiser generates and
  sends: authorises check-in on *that thread only*, dies after the event.

Recommend **(c)**, sharing the capability pattern `checkin_code` already
uses — small blast radius, no account required, revocable. The person at the
door taps a link and has a scanner; they never see the rest of the workspace.

**Accept / reject:**

---

## 4. If accepted, the build

**API** — `apps/api/src/routes/portal.ts`, new. `GET /api/v1/me/portal` returns
groups keyed by workspace, each containing tickets, threads (with agenda +
links), meets, memberships. Auth: the participant-JWT pattern already proven
twice — verify the Supabase session against JWKS, take *only* the email, run on
`adminClient`, and scope **every** query explicitly to persons matching that
email. RLS does not protect these handlers; the explicit email filter is the
whole security model. `person.email` is `citext`, so `eq` is
case-insensitive — matching the existing portals.

That security model belongs **in the route file as a comment**, not only in
this document — the doc will not be open when someone edits the handler six
months from now. Same reasoning as the header already at the top of
`lib/checkin.ts`.

**Purchase-ledger rows need both keys, not one.** Checked against
`20260704091000_purchase_ledger.sql`: `purchase.person_id` is nullable
(`on delete set null`) and `payer_email` is a nullable `citext`. So neither
column alone finds a visitor's own rows — filtering by `person_id` drops rows
written before a person row existed, and filtering by `payer_email` drops rows
where an organiser recorded a payment without one. Resolve the person ids for
the verified email first, then match `person_id in (…) or payer_email = <email>`.
Thanks to the i18n session for the catch.

`participantEmailFromAuth` is currently duplicated in `thread.ts` and
`membership-portal.ts`, with a comment saying the duplication is deliberate so
the two participant surfaces can evolve independently. A platform-owned portal
is the moment that comment stops being true: promote it to
`apps/api/src/lib/participant-auth.ts` and have all three use it.

**Web** — the portal surface per D2. Shared components first (binding rule):
check `packages/shared/src/ui` before building any of it; anything recurring is
born in `@thefibre/shared` with `apiFetch`/server actions injected as props.

**PWA** — manifest, icon set, service worker scoped to the portal. Ticket QRs
cached per visitor; everything else network-first.

**Door** — the capability link per D5, then the existing `DoorList` rendered
outside `(app)`.

**Order:** D1–D3 settle the shape → API → portal read-only → tickets in the
portal → PWA shell → door capability. Each step ships on its own.

## 5. Coordination

Shared working tree tonight. Lanes agreed with the website/branding session:

- **Mine:** `docs/visitor-portal-proposal.md`, `apps/api/src/routes/portal.ts`,
  `apps/api/src/lib/participant-auth.ts`, the portal surface, PWA assets.
- **Theirs:** `apps/website/**`, `packages/shared` branding/marketing-footer/
  legal-docs/user-menu, `apps/web` public pages + launcher.
- **i18n session:** `apps/thread` + templates + i18n.

If D2 lands on option (a), `apps/thread/app/my/**` must be taken as announced
leaf files only. **Agreed with the i18n session (thefibre-4e):** those leaf
paths are mine on announcement; they have nothing in flight under `/my` and
will say so before starting anything there.

**Registry ownership.** If D2 lands on `my.thethread.app`, the branding session
owns `packages/shared/src/branding.ts` and will land the APPS registration
themselves — I send them slug, display name, tagline and dev port; they wire
the registry, CORS, and the TransIP/Vercel steps on Sjoerd's checklist. I do
not touch that file.

**New i18n strings** (either option) I patch into `apps/thread/lib/i18n.ts`
myself rather than handing over — the i18n session explicitly declined being a
serialization choke point. Their merge conditions, which are now binding on
this work:

- Additive only; one contiguous block appended at the **tail** of the catalog
  object, never interleaved into existing entries.
- Every key carries all six locales — `en`, `nl`, `es`, `pt`, `de`, `fr`. The
  catalog is typed, so a missing locale is a compile error; that is the guard
  working, not an obstacle.
- Machine-drafted `es`/`pt`/`de`/`fr` lines carry a trailing `// MT`. Dutch may
  be drafted but **Sjoerd reviews NL personally** — mark it `// MT` when unsure.
- `pt` is **Brazilian** Portuguese.
- Announce the commit on the session channel. A tail-append conflict is trivial;
  later lander heals it.

Release discipline: explicit paths, never `git add -A`; ten `package.json`s +
`apps/web/lib/version.ts` + CHANGELOG in the same commit; push only via
`./scripts/release.sh <version>`.

## 6. Open items this depends on (Sjoerd, not code)

1. **Apple Pass Type ID certificate** — unlocks Add to Apple Wallet.
2. **Google Wallet issuer + service account** — unlocks Save to Google Wallet.

Both are already coded against. Until they exist, the ticket email shows the QR
and no wallet buttons.


---

## 7. Build log

### Landed in the working tree (uncommitted, 2026-09-08)

- `apps/api/src/routes/portal.ts` — `GET /api/v1/me/portal`. Groups by
  workspace; carries tickets, threads (with agenda + links), meets,
  memberships. File header states the wall exemption and the security model,
  per the i18n session's note that the doc won't be open when someone edits
  the handler.
- `apps/api/src/lib/participant-auth.ts` — `participantEmailFromAuth`,
  promoted out of the two copies in `thread.ts` and `membership-portal.ts`.
  Those copies are untouched for now: the comment saying the duplication was
  deliberate stops being true only once a third caller exists, and swapping
  them over is a separate, testable change.
- `apps/api/src/lib/portal.ts` + `portal.test.ts` — the two pieces of
  judgement, extracted pure and locked by 8 tests.
- `apps/api/src/middleware/app-context.ts` — `/api/v1/me/` added to
  `PUBLIC_PREFIXES` (participant JWT verified in-handler; the caller has no
  workspace claims and no `X-App-ID`).
- `apps/api/src/server.ts` — route mounted.

### Verified

- All ten packages typecheck; API suite 46 tests pass, including the 8 new.
- `GET /api/v1/me/portal` returns the handler's own 401 with no token and with
  a junk token — which also proves the middleware exemption works, since
  otherwise the refusal would come from `app-context` instead.
- Queries run against real data via a read-only scratchpad probe. This caught
  **two column errors that typecheck cannot see**, because the Supabase client
  is untyped here:
  - `thread_thread.location` does not exist. Threads have no location; the
    place a person goes is on the engagement. `lib/checkin.ts` sets the
    ticket's location to `null` for the same reason. The portal now takes the
    first agenda item that names one — strictly better than the email.
  - `meet_host.display_name` does not exist. The host's name is on the user
    row, with the slug as fallback — the idiom already in `routes/meet.ts`.
- A real cross-app participant resolves correctly: 2 person rows across 2
  workspaces, 1 thread enrolment with an admissible ticket, 9 agenda items,
  1 Meet booking, grouped into a single organiser card.
- **The dual-key merge earned its place on that same record:** the booking was
  returned by *both* the person-id query and the email query. Without
  `mergeById` the visitor would see the same meeting twice.

### Not yet verified

A full HTTP round-trip with a real participant token. That needs a browser
sign-in to mint one, and minting a session against a real person's account
isn't something to do unattended. The queries are proven and the assembly
between them is pure, typechecked and tested — but the payload has not been
seen end to end, and it should be before the surface is built on it.

### Deliberately not built yet

- The purchase ledger is not read. Invoices weren't among Sjoerd's four items.
  The dual-key note in the header is guidance for whoever adds them.
- `thread.ts` and `membership-portal.ts` still hold their own copies of
  `participantEmailFromAuth`.
- No CORS entry for `my.thethread.app` yet — `PROD_ORIGINS` derives from
  `APP_IDS`, which is precisely why the surface registry question below matters.

### One consequence of the registry decision, found while building

`PROD_ORIGINS` in `apps/api/src/server.ts` is built as
`APP_IDS.map((slug) => appUrl(slug))` — derived from the registry and
explicitly **never hand-listed**, because a hand-written copy once missed
`membership.thefibre.tech` and CORS-blocked the join page during the
2026-09-05 payment rehearsal.

So keeping the portal out of `APPS` (§D2) has a cost: it does not inherit
CORS. The fix must not be to hand-list it — that reintroduces exactly the bug
the v0.39.1 rule exists to prevent. Derive `PROD_ORIGINS` from both lists:
the app registry **and** the surface registry. Then a future surface is
covered the same way a future app is.
