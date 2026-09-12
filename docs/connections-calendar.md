# Scan and plan: the calendar as the CRM's spine

*Written 2026-09-11, in response to Sjoerd: "it would be great if the sales app
can scan and plan in the calendar". Third companion to
[`connections-what-exists.md`](connections-what-exists.md) (what Fibre already
has) and [`connections-market.md`](connections-market.md) (what
the market and the adoption data say). A fourth,
[`connections-data-integrity.md`](connections-data-integrity.md), covers how a
quick-capture surface stays safe and carries the current build order.

> **Reframed 2026-09-11 — read this first:**
> [`connections-model.md`](connections-model.md). Sjoerd: for facilitators the
> core need is a *landscape* — where is everybody, what needs attention, who
> knows whom, what needs moving — and closeness to the community rather than
> sales. **The pipeline is a view of that, not the other way round.** That doc
> carries the current build order and decisions **D23–D27**. **This document revises decision D4 in
the first one.***

---

## 1. The finding

Both halves — scanning and planning — work on permissions users have already
granted. Nothing needs new consent, a new OAuth flow, or a Google review.

`apps/api/src/lib/google/client.ts` requests three scopes today:

```
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/userinfo.email
```

That is read **and** write, live in production, with refresh tokens stored per
user in `user_connection.google_refresh_token` and read through the single
sanctioned accessor `apps/api/src/lib/connections.ts`. The library already
exposes `listCalendars`, `freeBusy`, `createEvent`, `patchEvent` and
`deleteEvent`, and Meet already writes real calendar events for bookings —
attendees, Google Meet links, the event id stored back on
`meet_booking.google_event_id`.

Even the multi-calendar model is right. `meet_calendar` gives each host any
number of Google calendars with a `role` of `primary`, `conflict_check` or
`write_target`. A scanner needs exactly that: which calendars to read, which
one to write into.

**What is missing is one function.** `freeBusy` returns busy intervals with no
titles and no attendees, which is all scheduling needed. Scanning needs
`events.list` — same scope, same token, roughly forty lines. That is the
entire technical gap on the read side.

This matters because of the landscape doc §6: mailbox sync is the expensive
capture channel, because Gmail scopes are restricted and put a mail-reading
permission in front of customers sold on data minimisation. **Calendar is the
capture channel Fibre already paid for.** And for facilitators and consultants,
the meeting *is* the conversation — the calendar holds a higher proportion of
the real relationship history than the mailbox does.

---

## 2. Scan: three things fall out of one read

Read the user's own calendar for a window, match attendee emails against
`person.email` in the workspace, and three of Sjoerd's seven verbs get answered
without anybody typing.

**Conversations, logged automatically.** A past event with a matched attendee
becomes a proposed `flow_note` — kind `meeting`, `happened_at` from the event
start, title from the event summary. It arrives as a draft with the body empty
and the cursor in it. The user writes what was said, or dismisses it. This is
the auto-filling archetype from the landscape doc, and it captures the
conversation type that matters most to this business.

**Initial contact, suggested.** An attendee whose email matches nobody is a
person you met who is not in Fibre. Surface as *"you met these three people
last week"* with an add button. **Never an automatic insert** — the landscape
doc's §8 refuses enrichment and scraping on principle, and quietly creating
person records from a calendar would be the same move wearing a different hat.
A suggestion the user accepts is consent; a background insert is not.

**Follow-up, prompted.** A logged meeting with no next action is exactly the
gap decision D7 exists to close. The draft note carries a follow-up field that
must be filled or explicitly declined.

### The minimisation rule: scan, match, discard

A calendar holds dentist appointments, school pickups, therapy. Reading it is
reading someone's life, and Fibre's whole promise is that it holds less than it
could.

So the rule, and it should be written into the code rather than the policy:
**the scanner reads events, matches attendees, and persists nothing about the
events it did not match.** No unmatched titles, no shadow calendar table, no
"we noticed you were busy Thursday". Matched events become a note the user
approves. Everything else is discarded in the same request that fetched it.

Stated as a Fibre principle: *the calendar is read, never copied.*

---

## 3. Plan: writing back

Two things worth writing, and one worth refusing.

**Time-block a task.** Drag a `flow_task` onto the day and it becomes a real
calendar event on the `write_target` calendar, with the task id in the event's
extended properties so the two stay joined. `createEvent` does this today,
with one change: `attendeeEmail` is currently required, and a time block has no
attendee. Make it optional.

**Book the follow-up through Meet.** This is the "feeding back into Meet" from
Sjoerd's first message, and it is more built than expected. Meet's slot engine
is live — `routes/meet.ts` already calls `freeBusy` across a host's
conflict-check calendars to compute availability. So from a conversation note,
"see Marja again in three weeks" can offer real free slots, or send her a Meet
booking link, using machinery in production since May. No new engine.

### 3.1 Auto-generated moments — scheduling the admin itself

*(Added 2026-09-11, answering Sjoerd: "can we auto generate moments in the
agenda to fill in the data?")*

Yes, and it is the sharpest answer to the adoption problem in the landscape
doc. Over 60% of CRM failures are adoption, and the cause is that logging never
has a time. Blocking the time is the fix, and Fibre can write the block itself:
`createEvent` exists, `meet_calendar` already knows which calendar is the
`write_target`, and `freeBusy` can find a gap that is genuinely free.

**Two rhythms, and the small one matters more.**

*The micro moment.* Five minutes immediately after a meeting that had a matched
attendee. This beats a daily batch on recency — you remember what was said at
14:35, not on Friday. The scanner already knows the meeting ended, so the block
places itself in the gap right after it.

*The macro moment.* A weekly half hour for the pipeline: rotting deals,
follow-ups coming due, drafts still unwritten. This is the one people
recognise, and it is where a review actually happens.

**Five rules, or it becomes noise people mute.**

1. **Carry the work, not a reminder.** The event title says what is waiting —
   *"Fibre: log 3 meetings, 2 follow-ups due"*. A block that says "CRM time"
   gets deleted by week three.
2. **The deep link goes in `location`, not only the description** (Sjoerd,
   2026-09-11). On a phone, location is the prominent tappable slot near the
   top of the event; the description sits below and gets truncated. One tap
   from the calendar into the exact page — the specific person, the specific
   list of drafts — not two taps and a scroll. `CreateEventInput` already
   carries `location` and `createEvent` already passes it to Google, so this
   costs nothing. Put a human-readable label in the description as well, for
   clients that render location as a map lookup.

   The general rule this is an instance of: **the moment should open the work,
   not announce it.** Anything that lands the user on a dashboard they then
   have to navigate has spent the tap and given nothing back.
3. **Never schedule an empty moment.** If there is no backlog, no block. An
   empty block is how a calendar integration teaches someone to ignore it.
4. **Back off when ignored.** A block declined or deleted twice running means
   stop, or ask. Fibre is writing into someone's own calendar, and the polite
   failure mode is silence.
5. **Opt-in, per user, with the cadence in their hands.** Writing uninvited
   into a calendar is invasive even when the intent is kind.

**The integrity rule applies here too.** Every Fibre-created event carries a
marker in its extended properties naming the origin and the id of the thing it
was made for — the same `origin` and `client_ref` discipline as
[`connections-data-integrity.md`](connections-data-integrity.md) §4.1 and
§4.3, applied to Google's storage rather than ours. Without it there is no way
to clear Fibre's blocks when a user disconnects, and no way to avoid writing the
same one twice after a failed request. A calendar quietly filling with duplicate
robot events is a very fast way to lose a user's trust in the whole platform.

**Do not push every task into the calendar.** The failure mode is obvious and
common: a calendar full of green blocks nobody honours, and a user who
disconnects the integration. Time-blocking is opt-in per task. Tasks live in
`flow_task`; the calendar shows the ones you deliberately made time for.

---

## 4. This revises D4

The exploration doc §5 proposed a **fourth data-wall crossing**: a read-only
agenda feed where each app contributes scheduled items so a Today surface could
show meetings alongside tasks. I flagged it as the decision with the most
architectural weight.

It is now mostly unnecessary. Meet bookings are already Google Calendar events.
Thread sessions could be. The calendar is where the user's day already lives,
including the parts Fibre will never know about. Building a parallel agenda
inside the platform means maintaining a second, worse copy of a thing every
user already has open in another tab.

**Revised recommendation.** Drop the fourth crossing as originally framed.
Instead:

- **Today reads two sources**: `flow_task` (which the platform owns outright)
  and the user's calendar (which the user owns outright). No crossing, because
  nothing moves between apps — Flow reads the user's own Google data under the
  user's own token.
- **Apps write to the calendar** rather than to a platform agenda table. Meet
  already does. Thread should, for the organiser's own sessions, opt-in.
- The crossing comes back only if Today needs items that are genuinely not
  calendar-shaped — the clearest candidate is
  `pulse_commitment_item.expected_date`, money expected this week, which is not
  an appointment and should not become one. That is a narrow enough case to
  handle as a direct Pulse read rather than a general crossing.

This is a simpler architecture and a smaller build. It also fails more
gracefully: a user who never connects Google gets a Today with tasks and money,
which is the fallback the original proposal described anyway.

---

## 5. Honest limits

- **Google only.** There is no Microsoft or Outlook calendar path anywhere in
  the repo — `sso.ts` names `microsoft` as an identity provider, and that is
  the extent of it. Anyone on Outlook gets tasks and no meetings. If a
  meaningful share of users are Microsoft, that is a separate build of similar
  size, not a config flag.
- **Only users who connected Google.** Connection today happens through Meet's
  settings for hosts. If the scanner becomes central, connecting has to be
  offered somewhere a non-Meet user will find it.
- **Matching is by email address, and will miss.** People book meetings from
  personal addresses. Expect a real miss rate, treat every match as a
  suggestion, and never let a bad match write silently.
- **Recurring events will produce noise.** A weekly internal standup with a
  matched colleague should not generate fifty-two draft notes. Needs a rule —
  probably: skip events whose attendees are all workspace members, and skip
  recurring series after the first.
- **Calendar titles are often useless.** "Coffee" tells you nothing. The draft
  note is a prompt to write something, not a record in itself.

---

## 6. What this adds to the build order

Slotting into the revised order in the landscape doc §7:

| Step | Item | Note |
|---|---|---|
| 1 | `flow_note` | unchanged — the scanner has nowhere to write without it |
| 2 | Rotting | unchanged — zero schema |
| 2b | **`listEvents()` + the match pass** | new. One function, existing scope, existing token |
| 3 | Contact context in the pipeline | unchanged |
| 3b | **Meeting → draft note, with the discard rule** | new. The auto-capture payoff |
| 4 | Growth view | unchanged |
| 5 | **Today = tasks + calendar** | simplified; D4 no longer blocks it |
| 5b | **Time-blocking and follow-up booking via Meet** | new. `createEvent` needs `attendeeEmail` made optional |
| 5c | **Auto-generated moments** (§3.1) | new. Needs `freeBusy` for placement and an origin marker on every written event |
| 6 | BCC-to-log | unchanged, and lower priority now — the calendar covers the meetings, BCC covers the emails |
| 7 | Offerings know their delivery | unchanged |

Steps 2b and 3b are the ones that change how the product feels. They turn Simple
Sales from something you fill in into something that arrives with a draft
already written.

---

## 7. Decisions

**D4 (revised) — Drop the fourth data-wall crossing.** Today reads `flow_task`
plus the user's own calendar; apps write scheduled things into the calendar
rather than into a platform agenda table. *Recommended: yes.* Less architecture,
less code, and it does not compete with the tool people already use.

**D9 — Scan, match, discard.** The scanner persists nothing about events it did
not match to a known person. *Recommended: yes,* and it belongs in the code and
in `building-on-the-fibre.md`, not only in this document.

**D10 — Unknown attendees are suggestions, never inserts.** *Recommended: yes.*
The difference between a helpful CRM and the scraping tools Fibre exists to
refuse is exactly one confirmation click.

**D22 — Fibre may write "moments" into the user's calendar,** opt-in, only
when there is a real backlog, carrying the work and a deep link, backing off
when ignored, and marked with its origin so it can be cleaned up.
*Recommended: yes* — it is the cheapest direct attack on the adoption problem,
and the micro moment right after a meeting is worth more than the weekly one.

**D11 — Is Microsoft calendar in scope?** *No recommendation — this is a
customer-base question, not a technical one.* If a meaningful share of Thread
organisers are on Outlook, the scanner is half a product without it, and that
should be known before step 2b rather than after.
