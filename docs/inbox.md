# Inbox

Sjoerd's gathering box. Raw items, captured as they arrive, from any chat.

**This is not the queue.** `docs/build-plan.md` is the queue and it claims to
be in priority order. Dropping unranked items into it breaks that claim
quietly. Items land here first, get ranked later, then move.

## There is a second capture file, and here is the line between them

`docs/connections-asks.md` was started 2026-09-13, hours after this one, from
the same complaint: *"It makes me a bit uncertain what gets picked up and what
not."* Neither file knew about the other, because this one has been sitting in
an unmerged draft PR all day.

They are not the same instrument and both should live:

- **This file is the front door for anything not yet assigned to an app.** A
  brainwave, an irritation, a half-formed idea from any chat. Unranked, in his
  words, unscoped.
- **`connections-asks.md` is a receipt ledger for Connections**, one row per
  ask with a status, logged before any work. It answers "did that get picked
  up", which this file does not try to.

**So the rule: an ask that clearly belongs to an app with its own ledger goes
there. Everything else lands here.** When an item here turns out to belong to
such an app, move it and leave the pointer, the same as moving to the build
plan.

## For any session reading this

- **Append, never reorder.** Newest at the bottom of Open.
- **Capture what he said**, in his words. Do not improve it, do not scope it,
  do not decide whether it is a good idea. A one line item is a complete item.
- **Add the date** and, where it helps, where it came from (which app, which
  chat, what he was doing).
- **When an item moves** into the build-plan queue, move it to Done below with
  the date and where it went. Never delete an item to tidy up.
- If an item is already shipped or already queued, say so next to it rather
  than dropping it.

## Open

### 2026-09-12 — different view types, and seeing connections between people

Sjoerd, in the fibre chat, with three Visual Thesaurus screenshots attached:

> Interface: I am not so happy witht the interface....
>
> I want to have different view types...
> Maybe one like the visual thesaurus.
> I want to see connectiosn between people....
>
> with one or more charateristics
>
> could also be a list.... ordder in what ranks more...
>
> but then there should be characteriustcis you can select or type..
>
> Like info is like a tag
>
> a tag could be closness, but also company
>
> (sorry - all this neededd to go to connections)

What the screenshots show, since they do not live in the repo:
visualthesaurus.com, the word "connection". A force-directed graph, one big
central word, related words radiating out on thin lines, small coloured dots
at the joints. Clicking a word re-centres the whole map on it (screenshot 2
is "connect", screenshot 3 is "collide with" after two clicks). A right-hand
panel lists the senses, grouped and colour-coded by part of speech, each
group with its own on/off switch that filters what the map draws. Dashed
lines mean a weaker or different relation than solid ones; one red dashed
line marks an opposite ("disconnect").

So the graph is one view, not the only one. A ranked list is another: the
same people, ordered by how much they rank on the characteristic. The
characteristic is the input to both views, picked from a list or typed. His
own gloss on what a characteristic is: a piece of information behaving like
a tag. His two examples pull in different directions: closeness, which is a
degree and orders naturally, and company, which is a category you either
share or do not.

**Surface: Connections** (`apps/connections`, slug `fibre-sales`). He said so
himself at the end. Its landscape already places people on derived axes, so
this lands on a screen that exists rather than a blank one.

**Where this stands against what is already written.** Rewritten 2026-09-12
21:00 UTC, after merging `staging`. The first version of this note was two
hours old and already wrong, because part of the item shipped while it sat.
Not a scoping decision, just what a reader should know.

**Already built, on `staging` and not yet released** (held at Sjoerd's
request while he looks at the Vercel bill):

- Tags exist. `v0.73.10` detects them while a note is being written, and
  organisation names count as tags. The "characteristic you can select or
  type" has a vocabulary behind it.
- The tag **list** and the tag **cloud** both shipped, on one page, and
  tapping a tag filters the people list. Band and tag filters compose. So
  "pick a characteristic, get the people who carry it" already works.
- `@` mentions for people and organisations, by intent rather than
  inference. People open in a popup.

**Then the rest of it shipped too, still on `staging`, still unreleased**
(v0.73.20, added here 2026-09-12 23:00 UTC):

- The **map**. Everyone at once: distance is recency, size is attention, ink
  is the ladder, over a year fades into a count. Clicking a dot opens the
  person popup.
- **"Who is near"**, which is the part he actually asked for. It draws lines
  from one person to their neighbourhood with every reason written out.
- Tags marked **inside the sentence** while typing (D71), not beside the box.

So between his message and this line, the whole item was built. What remains
of it is only the half he opened with: *"I am not so happy witht the
interface"*. That is a complaint about the landscape as it stands, separable
from the views, and nobody has touched it. Worth asking him whether the new
map answers it or whether the original irritation is still there.

**One open gap inside what shipped.** Placement on the map is a plain hash of
the person id, so people who belong together are not drawn together. Named as
a gap rather than faked; `connections-desktop.md` §5c resolves it with a
nightly snapshot. If his Visual Thesaurus reference was about clustering as
much as about lines, this is the piece still missing.

**And then he said the rest of it out loud, to another session** (2026-09-13,
recorded in `d3e414f`):

> a moving web of connection. You click on a name (not a dot) and then you see
> the connections.. you click on the next... and that one is centered (and
> bigger)... you can always go Back.

and, separately: *"company needs to be connected to the person."* Which is the
Visual Thesaurus behaviour named exactly, four screenshots' worth of intent in
two lines. It shipped the same night as v0.73.24, on staging: one person in the
middle, strongest connections nearest, each saying why underneath, click a name
and it travels to the centre while the web rebuilds, the name you came from
staying faded behind you, Back being the browser's Back. Companies are boxed
nodes on solid lines where a membership is recorded, and not drawn at all where
a company was merely named in a note.

So the item that opened this file is now built end to end, and the hash-placement
gap above is superseded for the web view: `lib/web-layout.ts` is a damped
simulation, not a hash. The still overview cloud keeps the hash placement (D38).

**And by the morning of 2026-09-13 the tuning was done too**, from his live
feedback rather than from the video: names not dots, size for strength, names
tied to each other and not only to the middle, a click gliding the whole cloud
so the one you came from lands opposite, easing, wide across the screen, a
density slider, draggable, and the middle leaning after the mouse. The build
plan no longer asks for the example video, because he described it in words
faster than anyone could have watched it.

**One more turn, and it settles the edges question for good** (v0.73.33, from
him reading the thesaurus again): *"lines are always via nodes", "no direct
lines", "the node is that a topic/theme/tag, without showing it... maybe only
with a mouseover"*. So no line runs from the middle straight to a name any
more. It runs to a JUNCTION and on to everyone sharing that one thing, and the
junction **is** the reason, unlabelled until you hover it. Three names hanging
off one dot read as three people who share something before you read a word.

That is a better answer than the dashed lines to the same problem, and worth
naming as such: the tension in this note was that a shared tag is not a
relationship but still wants drawing. Making the reason its own node says
exactly that, structurally. Two people are not joined; they are both joined to
the thing they share.

**So this item is closed as a request.** Three things are worth carrying
forward from how it went, all recorded in the build plan:

- **He reported not seeing the cloud for hours while it was deployed**, because
  `/map` opened on the dot overview with the cloud one click in. The front door
  is now the cloud. A feature one click from where somebody looks is a feature
  that does not exist.
- **Staging had no ties to draw.** A scrambled clone copied the people and
  almost nothing that connects them: 2 tags and 0 relationships across 30
  people, so the map rendered correctly and read as broken.
  `scripts/seed-staging-connections.mjs` exists now.
- **Emergent spreading did not work.** Link springs dragged a cluster, and the
  whole cloud with it, to one side. Names are given a direction each instead.

**Still open, and it is the one thing his original screenshots had that this
does not:** map clusters. Placement in the overview is a plain hash of the
person id, so people who belong together are not placed together.
`connections-desktop.md` §5c resolves it with a nightly snapshot. Named as a
gap rather than faked.

**Two things that push back on the item as stated:**

- **Ranking.** He asked for a list *"ordder in what ranks more"*. The cloud
  that shipped does the opposite on purpose: size is reach, opacity is
  connective strength, and strength FALLS as reach grows, so the biggest word
  is deliberately not the most important one. A tag on three people is a
  strong link; a tag on nearly everybody is a category. If he means "most
  people first", that is a different ordering from the one the model argues
  for, and the disagreement is worth surfacing rather than silently picking
  one.
- **Edges.** `docs/system-handbook.md`, same day: *"co-occurrence is not a
  relationship."* Two people sharing a tag have co-occurred. Drawing a line
  between them because they share one is precisely the inference that rule
  forbids, because an edge meaning "somebody states these two know each
  other" quietly starts meaning "these two were typed near each other".
  **The counter-reading, which matters here:** the rule is about what gets
  STORED in `relationship`, not about what a view may draw. A layout that
  places people near each other because they share a tag stores nothing and
  claims nothing. So his graph is not forbidden; one implementation of it is.
  **The map that shipped a few hours later holds exactly that line**, arrived
  at independently: a stated relationship draws a solid line, a shared tag or
  organisation or mention draws a dashed one, each with its reason written
  out, positioned and weighted but never stored and never fed into another
  computation (`system-handbook.md` §12). Shared attributes weigh by rarity,
  so a tag on two people pulls them together and a tag on everybody pulls
  nobody. Left in this note as written, because the question was real when it
  was asked and the answer is worth keeping next to it.

**One caveat on his example tags.** Of the two he named, closeness is the
last axis with no history: a current-state column. A view ranking people by
closeness can show where they stand and cannot show them moving. Company does
not have that problem.

Not scoped.


### 2026-09-14 — five features for Thread

Sjoerd, in the fibre chat:

> Feautres for Thread:
>
> Label printing
> Names and teams (make couples, teams etc...)
> Reschedule.. people should be able to unregister (mark conditions as a
> setting when this is actibvated) or rebook (replacement course should be
> seleected). Visitor can the do this themselvess.. of set.
>
> Further: to do list per thread for the facilitators  (what to do.. team
> member tasked (if any), date....)
> To do list template builder... (auto connected to a thread template).

Checked against the code on 2026-09-14 rather than guessed. Not scoped, not
ranked, and the notes below are what a builder should know before starting,
not decisions.

**1. Label printing.** Nothing prints labels. Printing exists for certificates
(`apps/thread/app/certificate/print/`), and the data a badge needs is already
there: every enrolment carries a unique `checkin_code`, and there is a QR
scanner at the door (`app/(app)/checkin/`, built 2026-09-10 and used at a real
door). A printed badge is the physical twin of that scanner. Whether he means
name badges, address labels or something else is the open question.

**2. Names and teams. Careful: "team" is already taken.** In this repo a team
is the ORGANISER side, a workspace grouping with its own slug that appears in
every public URL, and there is a standing gotcha that public organiser-slug
queries must filter `.is('team_id', null)` or team threads leak into the wrong
list. What he is asking for is grouping PARTICIPANTS, couples and teams among
the people enrolled. Same word, different entity. Naming it `team` would
collide with something load-bearing; the concept needs its own name before it
needs a table.

**3. Reschedule, unregister, rebook.** Half of the state exists and none of the
door does. `enrolment.status` already allows `dropped`, so an enrolment can
end; nothing participant-facing can reach it. The `/my` portal is read-only
apart from managing a payment method. So this is three things, and they get
harder in order:

- **unregister** — reach an existing status from the participant side;
- **conditions as a setting** — a per-thread cancellation policy, which is new
  and is the part that decides whether the other two are safe to expose;
- **rebook** — move an enrolment to another thread. This one touches money.
  Thread already has Reimburse (full, with the fee returned) on the invoices
  page, so the question is not "can we refund" but whether a rebooking moves
  the payment, refunds and recharges, or does neither.

**4 and 5. The to-do list, and its template builder. Flow already built this.**
`flow_step_default_task` is a task TEMPLATE attached to a step: title,
description, who it is for (`personal` / `team` / `contact`), a default
assignee role, and a due date expressed as days after entry. `flow_task` is
the materialised to-do, created from those defaults or by hand. That is items
4 and 5 almost exactly, one app over: a to-do with an assignee and a date, and
a template that produces them automatically.

So the real question is not how to build it but whether Thread gets its own
copy. The components-first rule (CLAUDE.md, binding) says never fork a per-app
variant, and a second task engine would be exactly that. Three shapes, and
somebody has to choose:

- Thread runs a Flow behind the scenes, and a thread template carries a flow;
- the task tables move up to the platform and both apps read them;
- Thread gets its own, and the repo carries two task engines on purpose.

Not scoped.

### 2026-09-15 — Element and Matrix: an exploration, not a build

Sjoerd, in the fibre chat, with a link to element.io:

> How can we work with: https://element.io/en

and, asked what problem it solves:

> Wah an explo to see if it is meaningful. And if so.. how.. and what is
> possible and what is the limit. Backlog conversation.

So this is an **exploration**, and it sits in the backlog as a conversation
rather than a build. What follows is the shape of that exploration, not a
proposal. Checked 2026-09-15: **nothing in this repo touches Matrix today.**
No homeserver, no `matrix-js-sdk`, no mention in any doc. Every "matrix" hit
is a test matrix, an RLS matrix or the plans matrix.

**What it is.** Element is the company and client around **Matrix**, an open
federated protocol for end-to-end encrypted messaging. Synapse is the
reference homeserver. Element Server Suite comes in Community and Pro, hosted
or on premise, pitched explicitly at digital sovereignty: every EU state
running its own stack and federating across borders.

---

#### 1. Is it meaningful

An exploration needs a question it can fail, or it is a survey. There are two
claims inside "meaningful" and they fail differently.

**The relational claim: a cohort wants to reach each other between sessions.**
This is testable **without touching Matrix at all.** If participants already
spin up WhatsApp groups around a thread, the demand is proven and the only
open question is where it should live. If they do not, no protocol fixes that,
and the exploration ends here for free. Ask a facilitator before reading
another spec.

**The sovereignty claim: it matters to somebody that the channel is EU and
open.** This is a positioning question, not a technical one, and the person
who can answer it is a customer, not a developer. It is also the claim most
likely to be true, since it is the argument this platform already makes.

Those two can be answered in a week of conversations and neither needs code.

#### 2. If so, how — four rungs, each with its own cost

1. **Point at a room somebody else runs.** Fibre stores an address on a
   thread and links to it. Holds nothing, operates nothing.
2. **Create the room and invite on enrolment.** Needs a server token and an
   application service. Fibre now acts on the homeserver.
3. **Read membership back as activity.** "Joined the room" as type and
   subject. Still no body, so still inside the wall.
4. **Embed the client, or hold content.** Crosses the wall.

Rungs 1 to 3 are additive and each is useful alone. Rung 4 is a different
product with a different legal posture.

#### 3. What is the limit

**The one that decides everything: federation versus erasure.** Matrix
redaction removes an event's content, and on a federated room the copies that
already reached other homeservers are *asked* to redact, not made to. Article
17 against servers nobody here controls is not a promise this platform can
keep. So the exploration's real deliverable is a decision on whether to
federate at all. A closed homeserver keeps the promise and loses the
cross-border story that is half the appeal. **Verify the current redaction
and federation semantics before trusting this paragraph** — it is stated from
knowledge, not from a source read on the day.

**The one that is secretly an argument for it.** If the rooms are properly
end-to-end encrypted, Fibre *cannot* read them, even holding the database.
That is not a limitation to work around. It is the data wall enforced by
cryptography instead of by discipline, which is stronger than any rule in
CLAUDE.md. Worth putting at the front of any write-up rather than the back.

**Identity.** Matrix IDs are their own namespace. `resolvePerson()` matches
on exact email because the handbook's exactness rule exists: a wrong match
attaches a claim to a real person. Mapping `@someone:server` to a person is
that same problem again.

**Weight.** Synapse is stateful: its own Postgres, media storage, federation,
an upgrade cadence. Today the platform is one Hono API on Fly plus Supabase.
A homeserver roughly doubles what has to be operated, three weeks after a
€300 Vercel fortnight forced the staging and promote split. Rung 1 avoids
this entirely, which is most of the argument for starting there.

#### 4. Where it would land, if it landed

A **room per thread** is the only candidate that uses something The Fibre has
and nothing else does: a thread is already a cohort with a start, an enrolment
list and a completion, so a room can be created on publish, joined on
enrolment and archived on completion. A second delivery channel beside the
Resend email is high friction, since every participant needs an account. Team
chat is generic and a hundred products do it.

Not scoped, not ranked.

### 2026-09-15 — Dex compared, and a gap in the market doc

Sjoerd, in the fibre chat:

> Can you check Dex CRM and see how it compares to our approach? And what is
> an MCP?

**Dex is a personal CRM** (getdex.com). One user, one price, roughly $12 a
month billed annually, $20 for the professional tier. Unlimited contacts,
keep-in-touch reminders on a Kanban board, LinkedIn sync that flags job
changes every few days, WhatsApp and iMessage and Gmail and calendar sync, AI
follow-up suggestions, custom fields.

**The finding worth acting on: it fits none of the four archetypes in
`connections-market.md` §2.** Pipeline-first, contact-first, auto-filling,
stewardship. Dex is a fifth shape the doc does not have: the unit of account
is one individual's own network, with no organisation anywhere in it. That is
not a smaller folk. It is a different theory of who a CRM is for. If the
comparison matters, §2 wants a fifth row, and that doc belongs to whoever
owns the Connections series rather than to this inbox.

**Three differences that are real, not just maturity:**

1. **The unit.** Dex is one person. Connections is a workspace with RLS, app
   membership and a shared relational field. A team cannot use Dex together,
   and a single freelancer does not need a workspace.
2. **Where the knowledge comes from.** Dex ingests your messages to infer
   relationship state. Connections refuses that by construction:
   `detect-tags.ts` declines to send note bodies to a model at all, and the
   handbook says co-occurrence is not a relationship. Dex knows more about you
   because it holds more of you. That is the trade, stated plainly, and it is
   the same trade `connections-data-integrity.md` was written about.
3. **What it optimises.** Dex is a cadence machine: it nudges you toward
   consistent outreach. Connections optimises for honest reporting, which is
   why the closeness axis says `unrated` instead of guessing.

**The honest concession.** For one person trying to stop forgetting to follow
up, Dex wins today. It is shipped, polished and cheap, and Connections is days
old. If that is the actual need, buying it beats building it.

**Where Connections is different rather than younger.** Market doc §4 already
says it: Pipedrive knows you won and does not know the workshop happened, who
came, whether they paid, whether they came back. Dex knows less still, because
it is attached to an inbox rather than to delivery. That is the moat and it is
already written down.

**One thing Dex does that is worth stealing.** LinkedIn job-change detection.
Somebody changing employer is a dated, stated fact about a person, not an
inference from co-occurrence, so it passes the exactness rule that keeps most
enrichment out. It would feed the organisation side that v0.75.23 just gave
labelled contact points to.

Not scoped. The MCP half of his message was a general question, answered in
chat, not an item.

## Moved out

_Items that graduated, with the date and destination._

### 2026-09-13 → `docs/connections-backlog.md` §1.1

The person-timeline item below graduated. Sjoerd said it again to another
session the next day, *"I want to improve the profile page - with activities -
a lot."*, and it is now the first open Connections item, with the same gap found
independently: `load.ts` fetches the card and the notes and nothing else. That
write-up is better than this capture on the shape question, naming three
products hiding inside "add activities" (a stream, a dossier, a tab on the
platform profile) and recommending the stream.

**One thing this capture has that §1.1 does not, and a builder will hit it.**
§1.1 says the stream should interleave "notes, activity events, stage changes,
meetings". There is no source for the stage changes. Re-checked against the code
on 2026-09-13: eleven API routes write `activity` rows and `pulse.ts` is not one
of them; nothing anywhere writes an activity row when a commitment moves stage.
So a stream built exactly as specified will show notes and meetings and never a
single deal moving, and whoever builds it will look for the bug in the merge.

The fix is one write, not a redesign: a stage move is type plus subject, which
is the shape `activity` takes. `pulse_commitment_stage_event` already records
every move by trigger, so the data is there and only the crossing is missing.

**Progress on it, checked 2026-09-13 15:00 UTC**, because a commit title can
read as more than it did. `4b01687` says "one shared timeline", and what it
means is that the Fibre contact page and Connections had written the SAME
design twice; it is now `@thefibre/shared/ui/timeline` and both use it. Good
work, and not the thing he asked for. `load.ts` still fetches the person card
and their notes and nothing else, so Connections renders notes in the shape of
a trail rather than rendering the trail. Same design, not the same content.

Both halves of the original finding are therefore still open, re-verified the
same minute: the person page reads no activities, and `pulse.ts` still writes
none, so there would be no stage moves in the stream even once it is read.

The original capture, kept whole:

### 2026-09-12 — the person page has no timeline, and stage moves are nowhere

Sjoerd, in the fibre chat, tagged `#connections`:

> when I get to a person... why cant I see the timeline of activitieis. And -
> in principles... I want to see a person in a popup. Quick scans. And if
> someone moved from a stage to another, for example there is an offer made,
> should the offer be there? I should somehow be able to scan the past
> engagements right?

Three questions. Checked against the code the same day rather than answered
from memory, because two of them have answers already and the third is a real
gap.

**1. The timeline. The data exists; Connections does not ask for it.**
`GET /api/v1/activities?person_id=…` already returns a cross-app timeline:
type, subject, when, and which app wrote it. It even expands merged people, so
tidying a duplicate does not lose their history. The Connections person page
(`apps/connections/app/(app)/people/[id]/page.tsx`) fetches identity and notes
and nothing else. Its own comment says why: *"Connections owns no person data
… what this page adds is the only thing in the app that cannot be derived: a
note somebody typed."* Defensible as a starting point, and it is the reason
the page reads thin. This is a missing render, not missing data.

**2. The popup. Already built**, on `staging`, unreleased, from his own
earlier request (`2636b92`, *"work with popups... like the threads"*). It is a
provider at the layout with one dialog and many openers, and `PersonLink`
stays a real link, so cmd-click still opens the full page. It currently shows
the same thing the page does: identity and notes.

**3. Stage moves. This is the gap.** Two halves, and they do not meet.

- The data half landed today. `pulse_commitment_stage_event` (v0.73.15) is an
  append-only log of stage moves, maintained by trigger so every writer is
  covered, whether the board dragged it or the dialog changed it.
- The crossing half does not exist. `pulse.ts` is the one app route that
  writes **no** `activity` rows at all. Notes, Thread, Meet, Flow,
  Membership, persons and organisations all write them; Pulse does not. So an
  offer being made is recorded in a Pulse table and appears on nobody's
  timeline.

So his instinct is right and the answer to *"should the offer be there?"* is
yes, and it is not, and the reason is one missing write rather than a design
that refused it. An activity row is type plus subject, which is exactly the
shape a stage move has.

**One thing to know before scoping it.** The activity log carries type and
subject only, never body (brief §6, and it is the data wall's whole point). So
a scan of past engagements shows *"offer made · Athens proposal"* and the date.
It will not show what was offered. If what he wants when he says "scan the past
engagements" is the substance rather than the trail, that is a different
request and a heavier one, because it means an app reaching into another app's
content.

Not scoped.
