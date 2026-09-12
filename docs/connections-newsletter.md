# Newsletters, and how sending mail feeds the Sales tool

*Written 2026-09-11, answering Sjoerd: "we might also build a mail system… or
maybe the Thread could be used for a newsletter system too, we might just need a
more comprehensive engagement type for HTML newsletter. But how can these tools
also feed the Sales tool?"*

*Fifth companion to [`connections-what-exists.md`](connections-what-exists.md),
[`connections-market.md`](connections-market.md),
[`connections-calendar.md`](connections-calendar.md) and
[`connections-data-integrity.md`](connections-data-integrity.md).*

> **Reframed 2026-09-11 — read this first:**
> [`connections-model.md`](connections-model.md). Sjoerd: for facilitators the
> core need is a *landscape* — where is everybody, what needs attention, who
> knows whom, what needs moving — and closeness to the community rather than
> sales. **The pipeline is a view of that, not the other way round.** That doc
> carries the current build order and decisions **D23–D27**.

---

## 1. Don't build a mail system

Fibre already is one, for a narrow definition of one. Thread sends scheduled and
triggered mail today with per-workspace sender identity and branding
(`threadEmailIdentity` — and there is a comment in the code specifically warning
the next person not to reintroduce the bug where an empty workspace silently
falls back to platform branding), six locales, four trigger kinds, a scheduler
running every five minutes, idempotent dedup on `(engagement, person)`, and
volume already metered for billing in `lib/plan.ts`.

Building a second mail system means rebuilding all of that beside itself. Your
instinct is right: the question is not "mail system or Thread", it is **what
does a newsletter need that a Thread message does not have.**

The answer is four things, and only one of them is large.

---

## 2. The four gaps

**2.1 An HTML body.** Today `thread_engagement.content` is a jsonb blob and the
renderer joins plain-text parts with `{name}`, `{thread}`, `{organiser}` and
`{date}` token substitution. A newsletter needs a rich body. This is a new
engagement type with a different content shape and a different renderer, plus a
composer in the timeline editor. Real work, bounded work, and exactly the "more
comprehensive engagement type" you described.

**2.2 A recipient list that is not an enrolment.** This is the actual
architectural gap. `sendTriggeredMessages` takes a `personId` and an `email`
because every Thread message is addressed to somebody *enrolled in that thread*.
A newsletter goes to an audience. Nothing in Fibre expresses an audience.

**2.3 The consent gate — and it is a legal blocker, not a nicety.**
`marketing_email` consent is already *captured*: `routes/thread.ts:5891` writes a
`consent_record` with legal basis `consent`. It is never *checked* before
sending. For today's mail that is correct — enrolment mail is transactional and
its basis is contract. For a newsletter it is not optional. The build plan
already carries this as an open item ("Email service consent-gate — don't send
`marketing_email` without an active consent record"); a newsletter makes it
mandatory rather than tidy.

**2.4 There is no unsubscribe anywhere in the codebase.** I searched: zero
occurrences across every app and package. One-click unsubscribe is legally
required for marketing mail and is enforced at the inbox-provider level by
Gmail and Yahoo bulk-sender rules, not merely by regulators. Nothing ships
without it.

---

## 3. The shape: a newsletter is a thread

Worth taking seriously, because it collapses most of 2.2.

A thread is a platform `program` row, and the format enum already reads
`meeting | event | journey | self_paced | blended`. Add `newsletter` and the
mapping falls out with almost nothing new:

| Newsletter concept | Existing Fibre concept |
|---|---|
| Subscribing | Enrolment |
| Unsubscribing | Enrolment withdrawn, plus a revoked consent record |
| An issue | A message engagement, scheduled |
| The archive | The thread's public page |
| The signup form | Thread's existing public enrol form and Webflow embeds |
| "My subscriptions" | The `/my` portal, which already lists a person's threads |
| Sender identity | `threadEmailIdentity`, already per workspace |
| Don't send twice | `thread_message_send`, already unique per (engagement, person) |

You get the subscribe page, the embed, the archive, the portal view and the
dedup for free. What stays genuinely new is the HTML body (2.1), the consent
gate (2.3) and unsubscribe (2.4).

Two things this does *not* solve and should not be forced to. A thread has a
start and an end; a newsletter is open-ended, so the timeline editor's
assumptions need checking. And a segment — "everyone who bought something last
year" — is still a query over people, not a list of enrolments. Which is the
next section, and the interesting one.

---

## 4. How mail feeds Sales

This is the part worth getting right. **If Fibre sends the mail, Fibre owns the
send record**, and that is four signals of very different value and very
different privacy cost.

**Delivered and bounced — take this first.** Zero privacy cost, pure data
quality, and today Fibre knows nothing. A bounce means the address on a person
record is dead, which is the most actionable fact a CRM can hold and the one
that silently rots. This needs a Resend webhook, and there is no Resend webhook
route in the repo at all. It also feeds directly into the integrity work in the
previous document: a bounced address is a strong signal for the merge tool.

**Sent — free, and needs one careful distinction.** A send is already recorded.
Turning it into an activity row costs nothing. But **a broadcast is not a
conversation**, and if newsletter sends feed `last_touchpoint_at` and the
rotting clock, the CRM will cheerfully tell you a dead deal is healthy because
the prospect received a mailshot. Broadcast touches and personal touches must be
different kinds, and only personal ones reset rot. This is a small design
decision that would be very annoying to discover later.

**Clicked — the real signal.** A click on a specific link is the strongest cheap
buying intent that exists. "Marja clicked the pricing page" becomes an activity
row, and optionally a task that surfaces in Today. This is the thing a
newsletter can give the pipeline that nothing else can.

**Opened — don't.** Open tracking means an invisible pixel in everyone's mail. It
sits badly with a platform whose entire promise is that it holds less than it
could, and it has been largely noise since Apple's Mail Privacy Protection began
pre-fetching images. Recommendation: **click tracking only, disclosed in the
privacy policy; no open tracking, ever.** This is a brand decision that happens
to also be the technically correct one.

### The loop runs both ways

The better half is Sales feeding the newsletter, not the reverse. Once an
audience is a saved query, it can be defined by pipeline state: everyone sitting
at Lead for sixty days, everyone who attended a thread last year and has bought
nothing since, everyone whose organisation is marked dormant. That is Flow,
Pulse and the purchase ledger composing into a mailing list — and it is the
thing no CRM at this price can do, because they do not hold delivery and money
in the same system.

### Replies

If mail goes out with reply-to set to the organiser's own address, replies land
in their mailbox and Fibre never sees them. That is exactly the hole the BCC
address (D8) fills: reply, BCC, and the reply becomes a conversation note
against the right person. The two mechanisms compose, and the newsletter makes
BCC more valuable rather than less.

---

## 5. What I would build, in order

Nothing here needs to happen before the Simple Sales steps in the integrity
doc §6. Slotted after them:

| Step | Item | Why here |
|---|---|---|
| A | **Resend webhook: delivered, bounced, complained** | Cheapest, highest data-quality return, no new UI, useful even if no newsletter ever ships |
| B | **The consent gate** | Already an open build-plan item. Blocks everything below it |
| C | **Unsubscribe** — one-click, per person, revokes the consent record | Legal floor |
| D | **`newsletter` format + HTML engagement type** | The build you described |
| E | **Audience as a saved query**, including pipeline state | Where it stops being a mail tool and starts being Fibre |
| F | **Click tracking → activity → optional task** | The signal that feeds the pipeline |

A, B and C are worth doing whether or not D happens. That is a good sign about
the ordering.

---

## 6. Decisions

**D17 — Extend Thread; do not build a separate mail system.** A newsletter is a
thread with format `newsletter`, subscriptions as enrolments, issues as message
engagements. *Recommended: yes.* It inherits the subscribe page, the embed, the
archive, the portal view and the send dedup.

**D18 — Click tracking yes, open tracking no.** Disclosed in the privacy policy.
*Recommended: yes,* and worth writing into the brief rather than only here,
because it will be re-proposed.

**D19 — Broadcast touches and personal touches are different kinds.** Only
personal ones reset the rotting clock or count as a touchpoint. *Recommended:
yes.* Cheap now, painful to retrofit.

**D20 — Resend delivery webhook first, before any newsletter work.** Bounces are
the highest-value, lowest-cost signal in this whole document, and they improve
data quality across every app that sends mail. *Recommended: yes.*

**D21 — Is an audience a saved query, or a list you hand-build?** *No
recommendation — this is a product call.* A query composes with Flow and the
ledger and is where the real differentiation sits. A hand-built list is what
people expect from a newsletter tool and is far simpler. Possibly both, with the
query as the interesting one.
