# Zoom Marketplace review — what we give them, and where it comes from

The reviewer's notes on "The Thread" (2026-10-08) ask for four things. This
file holds the answers, each with the place it was read from rather than
remembered, and says plainly which one is not ready.

The submission's own history is `docs/zoom-marketplace-submission.md`. This is
only the review round.

---

## 1. The direct landing URL — DONE (v1.115.x)

| | |
|---|---|
| **Production** | `https://thefibre.app/integrations/zoom` |
| **Staging twin** | `https://thefibre.tech/integrations/zoom` |

**Why not `/settings/connections`, the page that already exists.** It fails
the second half of the requirement. Signed out, every page under the
platform's `(app)` layout bounced to the marketing landing page — so a
reviewer who is not signed in arrives, gets redirected to a page about the
product, and has no route onward. Measured before the change, on a production
build of the app:

```
GET /settings/connections  → 307  Location: /
GET /integrations/zoom     → 307  Location: /sign-in?next=%2Fintegrations%2Fzoom
```

Signed in, `/integrations/zoom` is the Zoom card and nothing else, so the
Connect button is the first thing in view. **Both halves verified on staging
after deploy** (2026-10-08): the signed-out round-trip by
`e2e/zoom-landing.spec.ts`, and the signed-in page by the gallery producer,
which found the heading "Connect Zoom" and the Connect button with nothing
else on the page. Signed out it goes through sign-in
and comes back to it — the same `next=` round-trip `/connect` has used since
the assistant work, now extended to `/integrations/*`.

It is also a PUBLISHED address: our settings layout is ours to rearrange, and
a URL in somebody else's marketplace listing is not. `/integrations/zoom`
stays put. `e2e/zoom-landing.spec.ts` checks the signed-out round-trip from
exactly the reviewer's starting position, and fails on a 404.

---

## 2. Development and Production redirect URLs — READ FROM THE MACHINES

Both are derived in code: `zoomRedirectUri()` is `${PUBLIC_API_URL}/api/v1/
meet/zoom/auth-callback` (`apps/api/src/lib/zoom/client.ts`). The values below
are `printenv PUBLIC_API_URL` on the running Fly machines, not guesses.

| Zoom app tab | Redirect / OAuth callback URL |
|---|---|
| **Development** | `https://thefibre-api-staging.fly.dev/api/v1/meet/zoom/auth-callback` |
| **Production** | `https://api.thethread.app/api/v1/meet/zoom/auth-callback` |

**Staging and production are on DIFFERENT Zoom apps.** Compared without
exposing anything: the sha256 of `ZOOM_CLIENT_ID` differs between the two Fly
apps. Which one is which is visible in the Marketplace account, not from here.

---

## 3. Gallery images — NOT READY, and this is the reason

`e2e/zoom-gallery.spec.ts` is the producer: run it and it writes PNGs at
Zoom's 1280×720, signed in as the permanent e2e fixture, with the staging bar
hidden. What it produced is in `draft/`, and those drafts are why this section
says not ready rather than handing over paths:

- The e2e fixture is called **"E2E Fixture (do not edit)"** in a workspace
  called **"E2E fixtures (permanent, do not edit)"**, and its bio is
  deliberate gibberish. That text is in every image.
- The fixture host has **no working hours**, so its public booking page reads
  *"No availability in the next 60 days."*
- **Zoom cannot be chosen at all by an account that has not connected Zoom** —
  the picker disables the option (`disabled: !zoomConnected` in Meet's
  meeting-type form). So the image of "a meeting type that meets on Zoom"
  cannot come from the fixture, and that test SKIPS with its reason rather
  than producing a picture of a greyed-out option.

Staging does have a genuine Zoom connection — `hello@thethread.app`, through
the development app, with real meeting types and bookings carrying real join
links. **None of it is in these images on purpose:** a gallery image goes to
strangers, and that account's workspace is a real one.

**Decided 2026-10-08: Sjoerd takes them himself**, signed in to his own
staging account, which has Zoom connected. The shot list is below.

### The shot list

Four images, in this order — it is the order a person meets the product in,
which is the order a reviewer reads a gallery.

**Where to be:** signed in on the STAGING stack (`*.thefibre.tech`) as the
account that has Zoom connected. Staging, not production, so nothing a real
customer owns is on screen.

**Size:** 1280×720 (16:9). That is what the producer uses and it is the
common gallery size; the Marketplace console states its own limits when you
upload, and if it asks for something different, it wins. A browser window at
1280×720 with no bookmarks bar, or a full-screen shot cropped to it.

**Before shooting:** hide the staging stripe if it is in frame — the thin
coloured line at the very top. It means nothing to a reviewer and makes the
product look unfinished. Zoom in the browser so text is comfortable to read
at 720px tall; a full-width desktop screenshot scaled down reads as tiny.

| # | File name | Page | What MUST be visible |
|---|---|---|---|
| 1 | `1-connect-zoom.png` | `https://thefibre.tech/integrations/zoom` | The heading **Connect Zoom**, the Zoom card, and the **Connect Zoom** button. This is the page our listing links to, so the reviewer should recognise it. If your account is already connected it will show the connected state and the account address instead — that is a fine image too, arguably a better one, but check the address shown is one you are content to publish. |
| 2 | `2-meeting-type-zoom.png` | Meet → a meeting type → **Conferencing** tab | The location picker with **Zoom** SELECTED. This is the one that needs the Zoom connection: without it the option is greyed out. The meeting type's name should read like a real one — "Introductory call", not "Zoom Test". |
| 3 | `3-public-booking-page.png` | The public page of that meeting type | The **"Zoom — link in invite"** line under the duration, and a column of real times on the right. If it says "No availability", that host has no working hours — set some first, or use a meeting type that has them. |
| 4 | `4-confirmation-with-join-link.png` | The confirmation page after a test booking, or the confirmation email | The **join link** (`https://…zoom.us/j/…`) as the invitee sees it. This is the payoff image: it shows what the integration actually produces. Make the booking against your own address so no one else's name is in it. |

Nothing in any of the four should contain somebody else's name, email address
or meeting. If an image would show a real invitee, book the slot yourself and
photograph that one instead.

Put the files in `docs/zoom-marketplace/` with exactly those names, replacing
nothing in `draft/` — those are mine, taken as the test fixture, and they are
there only to show the shape.

---

## 4. The reviewer's test account — no password, no 2FA, a code by email

`ben.user1@zoomappsec.us`, invited by Sjoerd into a workspace on production.
The account is his to create; this is the path it would then take.

1. Open `https://thefibre.app/integrations/zoom` (the listing URL). Signed
   out, it goes to `/sign-in?next=/integrations/zoom`.
2. On the sign-in screen, choose the **email sign-in code** rather than
   Continue with Google — the page says so in as many words, for exactly this
   case: an invited address with no Google account on it.
3. Enter `ben.user1@zoomappsec.us`. Supabase sends a mail to that address.
4. **The mail contains both an 8-digit code and a sign-in link.** Either
   works: type the code, or click the link.
5. Back on `/integrations/zoom`, signed in, with the Connect button.

**On the reviewer's "disable 2FA and magic links":** there is no second
factor to disable. The single factor is possession of that mailbox, which
they have told us they control. The link in the mail is not a second step —
it is the same step as the code, offered twice; a reviewer who prefers typing
the code can ignore it. We have no passwords at all, so there is nothing else
to turn off.
