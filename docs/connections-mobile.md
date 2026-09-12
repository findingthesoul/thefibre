# The landscape surface: seeing a vast network on a small screen

*Written 2026-09-11, from Sjoerd's five requirements — see the landscape; make
it visually appealing as an overview; organise the map different ways (maturity
of the relation, potential deal, passing a threshold of engagement); a clear
what's next; a clear what do I need to prepare, across today, tomorrow, this
week and next week. **Goal: simple overview. Facilitators have vast networks and
a great volume of conversations. Mobile first.***

*Companion to [`connections-model.md`](connections-model.md), which defines
what the landscape is made of. This one is about how it is seen.*

> **Desktop counterpart:**
> [`connections-desktop.md`](connections-desktop.md) — the orbit
> view, semantic zoom, and the person popup. One model, two representations;
> the axis picker is the same control in both. Decisions **D37–D42**.


> **Naming (decided 2026-09-11):** the surface is called **Connections**. The
> words *landscape*, *map*, *cloud* and *lens* throughout these documents are
> thinking language, not product language — Thread carries the metaphor for this
> platform and everything beside it says what it is. See
> [`connections-naming.md`](connections-naming.md) §5.5.

---

## 1. The actual design problem

Three of the requirements pull against each other: **a vast network, a simple
overview, and a phone.** That tension is the whole design, and pretending it
away produces the thing every CRM ships — a contact list with filters.

The resolution: **you cannot show a vast network, and you should stop trying.**
A thousand people do not fit on a screen and would not help if they did. What
fits, and what a facilitator actually needs, is two much smaller things:

- **The shape** — the whole community as proportions, not people. Glanceable,
  stable, changes slowly.
- **The queue** — the handful that need something from you now. Specific,
  short, changes daily.

Everything below follows from keeping those two separate. The shape is for
orientation and it answers "where is everybody". The queue is for action and it
answers "who needs me". Merging them gives you a dashboard that is neither.

---

## 2. The shape: one visual, many axes

Sjoerd's third requirement — organise the map different ways — is the key to
making this simple rather than sprawling. **The same population, re-segmented by
a chosen axis, in an identical visual.** The picker changes what the bands mean;
the grammar never changes. Learn it once, read it five ways.

### The form

Horizontal bands stacked vertically, each a full-width row with a proportional
fill, a count, and a movement indicator against last month. Tapping a band opens
that cohort.

Why this and not the alternatives:

- **Not a node graph — on mobile.** *(Narrowed 2026-09-11: this rule now applies
  to sociocentric force layouts only. Desktop gets a spatial view — see
  [`connections-desktop.md`](connections-desktop.md), which
  revises this bullet.)* A force-directed hairball has no origin, so position
  means nothing; it demos well and answers no question. An egocentric, encoded
  orbit is a different object, and it needs a screen this surface does not
  have.
- **Not a pie.** Humans read angles badly, and it dies below 375px.
- **Not a table.** Dense grids are a desktop form. On a phone they become
  horizontal scroll, which is the one thing the project's own rules forbid.

Bands read as layers, which is what the word landscape is already reaching for,
and they are thumb-sized targets.

### The axes

| Axis | Bands | The question it answers |
|---|---|---|
| **Maturity** | touched → attended → returned → contributor → facilitator → dormant | Where is everybody |
| **Closeness** | weak / warm / strong / advocate | Who is actually near us — `relationship_strength`, a live field today |
| **Cadence** | in rhythm / slowing / quiet | Who is drifting |
| **Opportunity** | none / open / proposal / committed | The sales lens, now one axis among several |
| **Contribution** | brought nobody / brought someone / brings regularly | Who multiplies — the introduction edges |

The pipeline being *one axis of five* is the clearest possible statement of the
reframe: sales is a way of looking at the community, not a separate place.

### What makes it worth opening twice

Proportions alone are a poster. **Movement is the reason to come back.** Under
the bands: *three people moved up a rung this week, one went quiet, one crossed
into contributor.* That line is the difference between a chart and a habit, and
every element of it is already computable from `activity`, `enrolment`,
`membership_member` and `purchase`.

---

## 3. What's next, and what to prepare — these are different

Requirements four and five look adjacent and are not. The distinction is worth
holding because the second one is the thing no CRM has.

**What's next** is what I owe. Tasks, follow-ups coming due, drafts unwritten,
a rotting deal. All of it is `flow_task` plus the attention conditions. Every
CRM does a version of this.

**What to prepare** is what is coming at me that needs work *before* it. It is
derived from an upcoming commitment plus the state of the people attached to
it, and Fibre can compute it only because it holds delivery, participation and
money in one system:

- *Athens starts in nine days. Four of the twelve enrolled have never been
  contacted.*
- *You are meeting Marja tomorrow. You last spoke eight months ago; here is
  what was said, who introduced her, and what she has been to since.*
- *Three people in Thursday's session have not paid.*
- *The joining message for next week's workshop has not gone out.*

The second bullet is the one facilitators will care about most — the pre-meeting
brief at eight in the morning. It is also the single best use of everything in
the landscape doc, and it needs no new data at all.

**Preparation appears on its own lead time, not the event's date.** A thread
needs attention two weeks out; a meeting brief needs ten minutes. Surfacing both
on the day the thing happens makes one useless and the other panic.

### The horizon

Today / tomorrow / this week / next week, as a segmented control rather than
four stacked sections — four sections means scrolling past three you did not
ask for. Default to today. The counts on each segment are the useful part
before you tap: you can see next week is heavy without opening it.

---

## 4. Mobile-first, stated as rules

Fibre already has the shell — bottom navigation across six apps since v0.45.0,
dialogs as sheets below the small breakpoint. These are the rules specific to
this surface.

1. **One question per screen.** The shape, or the queue, or the horizon. Never
   two beside each other; there is no beside.
2. **Counts before lists.** A number you trust beats a list you must scan. Every
   band, every horizon segment, every attention condition leads with its count.
3. **No list longer than a thumb-scroll without a filter above it.** With a vast
   network, an unbounded list is a failure state, not a feature. Cursor
   pagination is already a hard rule in this project.
4. **Every row taps into exactly one thing.** No row that opens a menu of
   choices. This is the same discipline as the capture rules — defaults, not
   forks.
5. **The shape survives a bad connection.** It is a cached read; last computed
   time shown. The queue is live because it must be.
6. **Nothing depends on hover.** Obvious, routinely violated by chart libraries
   where the value only exists in a tooltip. Put the numbers on the bands.

On the visual language itself: it should come from Thread, which is
design-leading in this codebase by standing rule, and the surface should be
born in `@thefibre/shared` rather than as a Flow-local page — this is exactly
the kind of recurring surface the components-first rule exists for.

---

## 5. What "vast" actually requires

Today the largest workspace holds single-digit people; `docs/scale-issues.md`
puts trouble at 10k persons and 100k activities. So this does not need
engineering for scale it does not have — but it does need the pattern that will
scale, chosen now, because the wrong one is a rewrite.

**Split by cost, not by concept.**

- **The aggregate is snapshotted.** Band distributions, cadence baselines,
  month-over-month movement — computed on a schedule into a jsonb payload.
  Fibre already has this exact pattern twice: `pulse_projection_snapshot` and
  `pulse_balance_snapshot`. Reuse the shape; there are no materialised views
  anywhere in this codebase and this is not the place to introduce the first.
- **The queue is live.** It is small, it is per-user, and it must reflect the
  note you wrote two minutes ago.

That split also resolves a tension with the rule that community standing is
derived and never typed: derived, yes — but *materialised* for the expensive
aggregate. Deriving a distribution over the full person table on every page load
is how this surface would get quietly abandoned for being slow.

---

## 6. What I am not specifying

The visual design. I have given the structure, the constraints, and what to
avoid and why. Colour, type, the actual feel of "visually appealing" is a design
pass against Thread's language, and specifying it in prose here would produce
something worse than a designer looking at a screen.

The one thing I would ask of that pass: **the shape should look like a
landscape, not like analytics.** The failure mode is a business-intelligence
dashboard with a friendly name. Bands of a community with people moving between
them is a different object from a KPI panel, and it should not be possible to
confuse the two at a glance.

---

## 7. Decisions

**D31 — The shape and the queue are separate surfaces.** Orientation and action
have different rhythms and different data costs. *Recommended: yes* — merging
them is how this becomes a dashboard nobody opens.

**D32 — One visual, five axes.** Identical bands; a picker changes what they
mean. The sales pipeline is one axis, not a separate place. *Recommended: yes.*

**D33 — Movement is shown, not just proportion.** Who moved a rung, who went
quiet, who crossed a threshold, since last month. *Recommended: yes* — it is the
difference between a chart and a daily habit.

**D34 — Preparation surfaces on its own lead time.** Not on the date of the
thing it prepares for. *Recommended: yes.*

**D35 — Snapshot the aggregate, compute the queue live.** Following
`pulse_projection_snapshot`. *Recommended: yes.*

**D36 — Where does this surface live?** *No recommendation — product call.* It
is cross-app by nature: it reads Thread, Meet, Pulse, Flow and the platform. It
could be a new top-level surface in Fibre web, the Flow dashboard grown up, or
the capture PWA's home screen. My mild instinct is the PWA, because mobile-first
is a requirement rather than a nice-to-have here and the shell would be built
for it — but that decides what the PWA is, so it is worth deciding deliberately
rather than by default.
