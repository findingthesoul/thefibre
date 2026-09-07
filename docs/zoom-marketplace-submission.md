# Zoom Marketplace submission packet — Meet (The Thread)

_2026-09-08. Rewritten from Soul Suite's packet
(`/Users/sjoerdair/Projects/souls calendar/docs/ZOOM_MARKETPLACE_SUBMISSION.md`,
written May 2026 and never submitted) for the names, URLs and scopes we
actually use. **Public branding is The Thread** — Fibre stays backstage
(naming brief). Paste each section into the matching field on
marketplace.zoom.us._

## Read this first: you may not need to submit at all

Two modes, and only the second needs a review:

- **Development mode** — create the app, set the two secrets, done in ~15
  minutes. Zoom lets **users on your own Zoom account** connect. If everyone
  who hosts on Meet is inside the soul.com Zoom org, stop here; this packet
  is for later.
- **Published** — required the moment a host **outside** your Zoom account
  wants to connect (a client, a partner org, a facilitator with their own
  Zoom). That's the review below: 1–2 rounds of questions, 5–10 business days
  each.

While in review the dev-mode app keeps working for your own account, so
nothing breaks during the window.

Setup steps for the app itself (redirect URL, secrets on Fly) live in
[`deploy.md` § Zoom](deploy.md) — not repeated here.

---

## URLs

| Field | Value |
| --- | --- |
| App home page | `https://meet.thethread.app` |
| Privacy Policy | `https://thethread.app/privacy-policy` |
| Terms of Use | `https://thethread.app/terms` |
| Support URL | `https://thethread.app/support` |
| Support email | `support@thefibre.app` |
| Documentation URL | `https://meet.thethread.app/docs/zoom` |

> The three legal/support pages are live (v0.18.2, moved to the thethread.app
> apex in v0.68.2). The support address is `ENTITY.supportEmail` in
> `packages/shared/src/branding.ts` — if you'd rather show a `@thethread.app`
> address to Zoom's reviewer and to users, change it there first; it is one
> constant and every surface follows.

---

## Basic information

**App name:** `Meet by The Thread`

> Not "Fibre Meet". The Zoom Marketplace listing is a public surface, and the
> public name is The Thread; "Fibre" appears nowhere a host can see.

**Short description (≤ 80 chars):**

> Scheduling for purpose-driven work — bookable links that create your Zoom meeting.

**Long description (~1000 chars):**

> Meet is the scheduling tool of The Thread, a platform for organisations
> doing purpose-driven work — conferences, learning journeys, membership
> communities. Hosts publish bookable links so participants, clients and
> partners can pick a time without back-and-forth. Meet reads free/busy from
> the host's calendar so booked time never shows as available, writes the
> booking back as a calendar event, and — when a meeting type is set to Zoom
> — creates the corresponding scheduled Zoom meeting on the host's own Zoom
> account. The join link then travels into the calendar event, the
> confirmation email and the booking page, so nobody has to paste a link
> anywhere. If the meeting is later moved, the same Zoom meeting is moved;
> if it is cancelled, the Zoom meeting is deleted. Each host connects their
> own Zoom account from Settings → Integrations and can disconnect at any
> time. Hosted in the EU.

**Category:** Scheduling / Productivity

**Audience:** Organisations using The Thread; each host connects their own
Zoom account.

---

## Scopes — and the exact call each one is for

Four granular scopes. Zoom's reviewers ask "which API call needs this?", so
each line names it. Sources: `apps/api/src/lib/zoom/client.ts` and the three
call sites in `apps/api/src/routes/meet.ts`
(`createZoomForBooking` / `moveZoomForBooking` / `cancelZoomForBooking`).

| Scope | Call | Justification to paste |
| --- | --- | --- |
| `user:read:user` | `GET /v2/users/me` | Read once, at connect time, to store and display the connected Zoom account's email. The host sees it on Settings → Integrations so they can confirm they connected the right Zoom account — several of our users have a personal and a work Zoom. No other user data is read or stored. |
| `meeting:write:meeting` | `POST /v2/users/me/meetings` | The core of the integration. When a participant books a meeting type the host set to Zoom, we create the corresponding scheduled meeting (type 2) on the host's account and attach the join URL to the calendar event, the confirmation email and the booking page. Without this scope Zoom conferencing cannot work at all. |
| `meeting:update:meeting` | `PATCH /v2/meetings/{id}` | When a booking is rescheduled we move the existing Zoom meeting to the new time rather than creating a second one, so the join link the participant already has keeps working. |
| `meeting:delete:meeting` | `DELETE /v2/meetings/{id}` | When a booking is cancelled we delete the Zoom meeting we created, so cancelled meetings don't linger on the host's Zoom account. |

Also state plainly:

- No account-level or admin scopes.
- No SDK / Zoom Apps / recording / chat / webhook scopes.
- We never read meeting content, participants, recordings or chat.
- We only ever touch meetings **this app created**.

---

## Data handling (the question that follows the scopes)

- **What we store:** the OAuth refresh token, the connected account's email,
  and — per booking — the Zoom meeting id and join URL.
- **Where:** Supabase, EU (Ireland). The refresh token lives in
  `user_connection`, a service-role-only table, never readable through the
  public API. It is not exposed to any client, and never leaves the EU.
- **Rotation:** Zoom rotates the refresh token on every exchange; we persist
  each rotation immediately (`apps/api/src/lib/zoom/host.ts`).
- **Removal:** "Disconnect" on Settings → Integrations deletes the token and
  the stored account email. Uninstalling from the Zoom App Marketplace has
  the same practical effect — the token stops working and is cleared on the
  next failed refresh (`invalid_grant` auto-clears it).
- **Retention:** we keep no Zoom data beyond the above.

---

## Test instructions for the reviewer

> **Access:** The Thread is invite-only, so we supply the reviewer with a
> test workspace login (sent separately, not in this document). The reviewer
> also needs their own Zoom test account to connect.

1. Sign in at `https://meet.thethread.app` with the credentials supplied.
2. Go to **Settings → Integrations** and click **Connect Zoom**. Approve the
   consent screen. The card then shows the connected Zoom account email and
   a **Disconnect** button.
3. Go to **Meeting types → New**. Name it "Zoom Reviewer Test", duration 30
   minutes, **Conferencing → Zoom**, save.
4. Open the public booking link shown on the meeting type (it looks like
   `https://meet.thethread.app/<host>/zoom-reviewer-test`) in a private
   window, pick any available time, and book with any name and email.
5. **Expected result:**
   - The confirmation page and the confirmation email both carry a Zoom join
     link.
   - The host's Zoom account (Zoom → Meetings → Upcoming) shows the new
     meeting, titled with the meeting-type name.
   - The host's calendar event carries the same join URL.
6. **Reschedule** (proves `meeting:update:meeting`): on the confirmation
   page click **Reschedule**, pick another time, confirm. The Zoom meeting
   moves; the join URL is unchanged.
7. **Cancel** (proves `meeting:delete:meeting`): click **Cancel** on the
   confirmation page. The meeting disappears from the host's Zoom account.
8. **Disconnect** (proves removal): Settings → Integrations → Disconnect.
   The stored token and account email are deleted.

### API calls the reviewer will observe

| Step | Call |
| --- | --- |
| Connect | `POST https://zoom.us/oauth/token` then `GET /v2/users/me` |
| Booking | `POST /v2/users/me/meetings` |
| Reschedule | `PATCH /v2/meetings/{id}` |
| Cancel | `DELETE /v2/meetings/{id}` |
| Any of the above, first call in an hour | `POST https://zoom.us/oauth/token` (refresh) |

---

## Submission checklist

- [x] `/docs/zoom` page built and live at `meet.thethread.app/docs/zoom` ✓ (v0.68.5)
- [ ] Privacy Policy live at `https://thethread.app/privacy-policy` ✓ (v0.68.2)
- [ ] Terms of Use live at `https://thethread.app/terms` ✓ (v0.68.2)
- [ ] Support page live at `https://thethread.app/support` ✓ (v0.68.2)
- [ ] App icon uploaded (192×192 PNG — the Thread mark)
- [ ] Short + long descriptions pasted into Basic Information
- [ ] Redirect URL + OAuth allow list set to
      `https://thefibre-api.fly.dev/api/v1/meet/zoom/auth-callback`
- [ ] Four scopes added, with the justifications above
- [ ] Data-handling answers pasted
- [ ] Test instructions pasted; test workspace login sent to the reviewer
- [ ] Submitted

## After submission

Zoom emails the reviewer's questions to the developer email on the app
(sjoerd@soul.com unless changed). Most apps go through 1–2 rounds. The three
that came back at Suite's packet stage, and how to answer them:

- *"Justify scope X more concretely"* — add a screenshot of the UI where the
  scope's effect is visible (the connected-account line; the join link on a
  booking).
- *"Your Privacy Policy doesn't mention Zoom data"* — check
  `thethread.app/privacy-policy` names the Zoom connection and what it
  stores; if it doesn't yet, add the paragraph before answering.
- *"Test instructions don't work"* — usually the test login expired or the
  reviewer's Zoom wasn't connected at step 2. Re-issue and re-share.
