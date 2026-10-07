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
Connect button is the first thing in view. Signed out it goes through sign-in
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

**The decision, which is Sjoerd's:** either point the producer at a
Zoom-connected account he is content to show publicly, or set up a small demo
account on staging (a presentable name, a bio, working hours, Zoom connected
once) and run it against that. The second is a couple of steps and gives
images with nobody's real data in them; it is what I would do. The spec takes
the identity it signs in as, so either way the change is small.

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
