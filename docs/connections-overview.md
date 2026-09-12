# Connections — three pillars: see, act, capture

*Written 2026-09-11, from Sjoerd naming the structure: the landscape of
relations; "from a relational journey, a second thing — what to do when (actual
tasks), or preparation of tasks, with an estimate of the amount of work"; and
"to create the relation, input is needed, documentation — so the third big
pillar is the specific PWA for easy input".*

**The surface is called Connections** (decided 2026-09-11 — [`connections-naming.md`](connections-naming.md)).
The slug `fibre-sales` never changes; `label: 'Sales'` in `apps/web/lib/apps.ts` becomes `'Connections'`.

*Index for the series. The other documents:
[connections-model.md](connections-model.md) (the model),
[connections-mobile.md](connections-mobile.md) (mobile),
[connections-desktop.md](connections-desktop.md) (the cloud),
[connections-what-exists.md](connections-what-exists.md),
[connections-market.md](connections-market.md),
[connections-calendar.md](connections-calendar.md),
[connections-data-integrity.md](connections-data-integrity.md),
[connections-newsletter.md](connections-newsletter.md).*

---

## 1. The structure

| Pillar | What it is | Where it lives | State |
|---|---|---|---|
| **See** | The landscape — where everybody is, who is drifting, who relates to whom | Desktop cloud; mobile bands | Reads over live tables; almost no new schema |
| **Act** | What to do when — tasks from a relational journey, with preparation and effort | Today surface; calendar | Engine exists in Flow; the forward view does not |
| **Capture** | Input and documentation — the reason anything above has content | The phone app | Not built |

They are in dependency order backwards: **capture feeds act feeds see**, and
the value runs the other way — see is why anyone bothers to capture. That
circularity is the product's central risk and §5 is about it.

---

## 2. Act: the engine already exists

"From a relational journey, what to do when" describes something Flow already
does. A `flow_run` places a person on a journey; entering a step materialises
that step's default tasks and the gate tasks on every transition leaving it.
Tasks arrive *because of where someone is*, which is exactly the mechanism
asked for.

So pillar two is not a build from nothing. What is missing is two things.

**A forward view.** Flow shows tasks; it does not show *next week*. The horizon
— today, tomorrow, this week, next week — from
[`connections-mobile.md`](connections-mobile.md) §3, with
preparation surfacing on its own lead time rather than on the date of the thing
it prepares for.

**An estimate of effort**, which is new and is the subject of the next section.

---

## 3. Effort estimates — the idea and its trap

An estimate on a task unlocks three things that are currently impossible:

- **Sizing a calendar moment.** A twenty-minute block because there are four
  conversations to log at five minutes each — not an arbitrary half hour. This
  closes the loop with [`connections-calendar.md`](connections-calendar.md)
  §3.1, where the moment currently has no principled duration.
- **Answering "what is next week".** *Four meetings, six hours of preparation,
  three threads needing attention.* A number turns a list into a plan.
- **Seeing overcommitment before it happens.** Next week holds fourteen hours of
  preparation and nine hours of unbooked time. Nothing in Fibre can say this
  today, and for a facilitator it is the single most useful sentence a tool
  could produce.

**The trap: asking for an estimate is a threshold**, and it contradicts the
capture rules agreed in
[`connections-data-integrity.md`](connections-data-integrity.md) §7.2 —
default from context, never ask. A task creation flow that demands a number
before it will accept the task is how people stop creating tasks.

**So estimates are defaulted by task kind and never required.** Logging a
conversation is five minutes. Preparing a session is two hours. Writing a
proposal is an hour. Every default is editable, none is asked for, and a task
with no estimate simply carries its kind's default rather than blocking. The
kind is already known, because tasks are materialised from flow steps and note
follow-ups that know what they are.

**Defaults are per workspace and adjustable in one place** — a facilitator who
needs forty minutes to prepare a session should change it once, not on every
task. That is a small settings table, not a field on every row.

I would *not* build learned estimates from actual completion times yet. The data
is noisy — a task marked done three days late was not a three-day task — and
the value over a decent default is small. Worth revisiting once there are
thousands of completed tasks, not before.

---

## 4. Capture: what it is, and what it is not

This is the phone app. Log a conversation, tick a task, add a follow-up, plan a
meet, note an encounter. Sjoerd's framing is right and sharper than mine was:
**it exists because the relation has to be documented before anything else can
work.**

The rules already agreed for it, gathered:

- **It owns no data.** Writes through the same API to the same tables as Flow;
  no schema, no local store beyond a queue of pending writes (D12).
- **It identifies as Flow.** A second front end, not a new app, so RLS and
  app membership stay exactly as they are.
- **Autosave, with drafts as a real state.** Derived effects fire on first
  commit, never per keystroke; abandoned drafts age out (D28).
- **Default everything, ask almost nothing.** One text box and a name; kind,
  date, person all inferred from where the capture came from (D29).
- **Offer the next action, do not block on it.** Three one-tap chips; leaving
  without choosing is allowed, and the omission surfaces in the landscape's
  attention list (D30).
- **Idempotent by client-generated id**, which is also what makes autosave and
  offline replay safe (D15).

And the thing it must not become: a local contact database. An offline outbox is
a queue that drains and clears. Caching the address book for offline browsing
breaks the first hard rule of the platform.

---

## 5. The circularity, which is the real risk

See is the reward. Capture is the cost. Act is the bridge. And **see is empty
until capture has been running for weeks**, which means the first weeks of this
product ask for effort and give back an empty room.

Every CRM dies here. It is the same finding as the adoption data in
[`connections-market.md`](connections-market.md) §1 — over 60%
of failures are adoption, and the complaint is always that the cost of entry
comes before the return.

Three things in Fibre break the circle, and they should be treated as
load-bearing rather than as nice extras:

**The landscape is not empty on day one.** Almost everything the see pillar
needs already exists — enrolments, threads attended, purchases, organisations,
memberships, professional attributes, who introduced whom. The first view a
facilitator opens is drawn from years of data they have already given Fibre
without knowing it. This is the single biggest structural advantage in the whole
exploration and it is why the landscape should ship *before* the capture app,
not after.

**The calendar fills itself.** Meeting drafts arrive without anyone typing
([`connections-calendar.md`](connections-calendar.md) §2). Capture starts as
editing rather than as composing, which is a far lower bar.

**The moments carry the work to you.** A block that opens directly onto three
waiting drafts is a different proposition from remembering to go and do
admin (§3.1 there, D22).

---

## 5.5 Mobile-first and desktop-first are not in conflict

*(Added 2026-09-11. Sjoerd: "the visual thesaurus is desktop only — conflicts
with mobile first. But I think landscaping is different than input of a quick
direct view, so the combo makes the work more possible.")*

This resolves what looked like a contradiction between *"this app is mobile
first"* and *"DESKTOP: imagine a web of people"*, and the resolution is better
than a compromise.

**The activity decides the surface, not the screen size.**

| Activity | Surface | Why |
|---|---|---|
| **Landscaping** — exploring, noticing, following a thread of relations | Desktop | A thinking activity. Needs space, time, and both hands. You do it on a Monday morning with coffee |
| **Capture and quick view** — logging what just happened, checking who is next | Mobile | A ten-second activity. Needs one thumb, done standing up, between two meetings |

Neither is a degraded version of the other, and neither is "responsive" in the
sense of the same page reflowing. They are **different tools for different
moments in the same work**, reading the same data.

This is why the combination makes the work possible, as Sjoerd put it: the
desktop view is where you decide *who matters this week*, and the phone is where
that decision survives contact with an actual day. A desktop-only product loses
everything that happens between meetings. A mobile-only product can never show
you the shape of anything.

**What stays shared:** the model, the characteristics, and the axis picker. The
same control that re-segments the mobile bands re-colours and re-filters the
desktop cloud. That is what keeps them one product rather than two apps that
happen to share a database.

**What this decides about D36:** the phone app is the primary surface for
capture and triage, not the primary face of the whole platform. Landscaping
lives on the desktop, in Fibre web. That is a narrower and more buildable scope
for the phone app than the open question implied, and it is the right one.

---

## 6. Build order, consolidated

Merging every revision so far. Steps 0–2 produce something useful before
anything is captured, which is the point.

| # | Item | Pillar |
|---|---|---|
| 0 | `resolvePerson()` + merge tool | foundation |
| 0b | Nightly hygiene sweep on the existing scheduler; retention policies decided | foundation |
| 1 | Landscape: derived lifecycle, mobile bands | see |
| 2 | The five attention conditions | see |
| 3 | `flow_note` — with `client_ref`, `origin`, `happened_at` | capture |
| 4 | Cadence and rotting, one mechanism for people and deals | see |
| 5 | Calendar scan → draft notes; auto-generated moments | capture |
| 6 | Today + the horizon; effort estimates and the forward view | act |
| 7 | The phone app | capture |
| 8 | Relationship edges: derived relatedness, the desktop cloud | see |
| 8b | **Entries** — who can get me in, and whom can I give an entry to | see |
| 9 | Pipeline as one axis; Pulse unchanged underneath | see |
| 10 | Newsletter; Resend delivery webhook; BCC capture | — |

The desktop cloud sits at 8 deliberately. It is the most compelling thing in the
series and the one that produces nothing without the eight steps under it.

---

## 7. Open decisions, gathered

Everything still genuinely undecided, in one place:

| # | Question | Where |
|---|---|---|
| **D11** | Is Microsoft calendar in scope? | calendar §5 |
| **D21** | Is an audience a saved query or a hand-built list? | newsletter §6 |
| **D69** | What are the retention policies? `retention_policy` exists and nothing has ever deleted anything | [connections-data-integrity.md](connections-data-integrity.md) §9.6 |
| **D27** | Which lifecycle rungs are real for soul.com and EBBF? | landscape §7 |
| ~~**D36**~~ | ~~Where does the landscape live?~~ **Resolved 2026-09-11 (§5.5):** landscaping is desktop, in Fibre web; the phone app is capture and triage | surface §7 |
| **D41** | Are relationship edge types fixed by the platform or per workspace? | desktop §9 |

| **D57** | Stitch or Knot for a conversation note? | same |

D27 is now the one that changes the shape of the build rather than a detail
inside it: the lifecycle rungs sit underneath every view in the series, and a
wrong ladder makes everything above it subtly off.
