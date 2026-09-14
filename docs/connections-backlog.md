# Connections — the backlog

Written 2026-09-13 at v0.73.41, on Sjoerd's instruction ("make a new full
backlog for connections"), by reading the code rather than the previous
backlog. Where something is checked against the running system or the source,
it says so; where it is a guess, it says that too.

`docs/build-plan.md` stays THE cross-app to-do list. This file is the
Connections detail it points at, so the Phase 4 section there can stay short.

**Where things stand.** In production to v0.73.23. **v0.73.24–41 are on
staging only** — Sjoerd's standing instruction, not an accident. Eighteen
releases, almost all of them the map.

---

## 0. The sharp one: an axis nobody can fill — **BUILT v0.73.43**

**The landscape has five readings. One of them could not be answered from
inside this app.** Shipped to staging 2026-09-13: the relationship card sits in
the person popup, above the note composer, and writes
`person_relationship_context`. What follows is the finding as it stood, kept
because the reasoning is what the next gap of this kind will be found by.

`closeness` is, by design, the one axis a human types in — the SQL says so in
as many words: *"the one axis a human types in by hand, and the only place in
this surface where that is right: how close somebody feels is not derivable
from events."* It reads `person_relationship_context.relationship_strength`.

The platform has the endpoint. `PATCH /persons/:id/relationship` accepts
`relationship_strength` ∈ weak | warm | strong | advocate, alongside `source`,
`introduced_by`, `communication_preference`, `is_key_contact`,
`is_ambassador` — and it is tagged **`fibre-sales`**, meaning Connections is
the app that justifies those fields existing at all (brief §5, "the app
justifies the field").

**Connections never reads or writes any of them.** Checked 2026-09-13: no
reference to `relationship_strength` anywhere under `apps/connections` except
a comment. So the axis shows everybody as `unrated` for ever unless somebody
goes to the Fibre platform UI to set it — and `unrated` is deliberately a
visible band rather than a silent default, which means the landscape is
honestly reporting that a fifth of itself is unusable.

This is also what Sjoerd asked for on 2026-09-13, in the same breath as the
popup-over-popup: *"And then see the CONNECTION card wirh absic info (maybe
edit their relation fields)."*

**What was built:** the card in the popup — how close, how you met, who
introduced them, key contact, speaks for us. Every control saves itself: there
is no Save button, because each control is a separate statement and the row is
upserted per field, so somebody who has just put the phone down can press
"warm" and close the popup. Pressing the chip that is already on clears it,
because `unrated` is a real band somebody must be able to return a person to.

`introduced_by` is a person picker handing over an id, never a typed name
(handbook §12).

**Still open on this:** `relationship_strength` has no history — §3.2 — so the
axis will show proportions and no movement however many people are rated. And
the card is in the POPUP only; the person's page (§1.1) should show the same
thing, which is an argument for it being a shared component the day that page
is built rather than a second copy.

**The trap it hit, worth remembering:** the value lists were first exported
from the `'use server'` module beside the actions. Everything a 'use server'
module exports must be an async function, so in the browser `STRENGTHS` was a
proxy and `STRENGTHS.map` threw — after a clean typecheck and a clean build.
Caught in the browser, not by the compiler. Values that both sides read belong
in a module with no directive at all (`relationship-vocab.ts`); the mirror
image of the same trap is written up in `landscape/axes.ts`.

---

## 1. Now

### 1.1 The person's page, with what actually happened on it
Sjoerd, 2026-09-13: *"I want to improve the profile page - with activities - a
lot."*

`apps/connections/app/(app)/people/[id]/load.ts` fetches exactly two things:
the person card and their notes. Nothing else this app knows about a person
appears on their own page — not the activity log, not where they sit on the
five axes, not why they are in the attention list, not their tags, their
organisations, their follow-ups, or who they are near (the map computes that
neighbourhood and the profile shows none of it).

Three shapes, and they are different products:
- a **single reverse-chronological stream** — notes, activity events, stage
  changes, meetings, interleaved. The honest shape of "what happened with this
  person", and it needs the activity read merged with `flow_run_note` rather
  than tabbed beside it;
- a **dossier** — who they are, where they sit, what is open, with history one
  section among several. Faster for "should I call them", worse for "what
  happened in March";
- a **tab on the platform profile**, which already composes per-app tabs from
  `GET /persons/:id/apps`. Two person pages that disagree is exactly the drift
  the components-first rule exists to stop.

Recommendation on file: the stream, under a compact header carrying band,
attention reason, organisations and tags.

**The constraint that shapes it:** activity carries type and subject, never a
body (brief §2). A merged stream shows THAT something happened and links out.
Designing it as if the event text were readable produces a page that cannot be
filled.

### 1.2 Step 10 — the newsletter
Resend delivery webhook, BCC capture. The last unbuilt step of the original
build order (`connections-overview.md` §6). Design is in
`docs/connections-newsletter.md`; D21 (audience = saved query or hand-built
list) is unanswered and blocks the shape of the audience picker, not the send.

### 1.3 Entries ignores tags, and cannot be told about a stranger
Sjoerd, 2026-09-13: *"in Entries: I thought you could fill in everything. Also
tags?"*

Both halves checked against the source, and both are real.

**Entries is a question box, not a form.** You search for somebody or something
the workspace ALREADY holds, and it answers "who can get you in". There is no
way to name a target it has no record of — which is precisely the cold-start
case, because the company you most need an introduction to is the one you have
nothing on. Today the only route is to create the organisation first, somewhere
else, and then come back and search for it.

**And tags are used nowhere in it.** `connections_entries` reads `relationship`,
`person_relationship_context`, `org_membership` and `thread_enrolment` — the
word "tag" does not appear in the function. The degrade, which answers when no
path exists, matches on the organisation's `sector` and `country` and nothing
else. So the app asks you to build a vocabulary on every note and then ignores
it in the one surface whose whole job is "who is near this".

**Tags belong in the DEGRADE, not in the paths, and the distinction is the
whole design.** A tag shared by two people is co-occurrence, and co-occurrence
is not a relationship (handbook §12) — so a tag must never become a path,
because a path is a claim that somebody can introduce you. But the degrade
already says out loud that its answers are *explicitly not entries*: "nobody
here can get you in, they are simply the nearest thing the data knows". A
shared word is exactly that kind of nearest thing. Shown, never computed on.

Which makes the order: sector, then country, then tags — each tried when the
one before comes back empty, the same degrade the function already performs.
Rarity matters here too (§3.5): a tag on three people is a strong signal and a
tag on three hundred is noise, so the tag attempt should prefer rare ones
rather than treating every word alike.

The "name a stranger" half is a bigger decision and is §2.6.

### 1.3b Nothing says what would move a person
Sjoerd, 2026-09-13: *"Imagine a person... she or he is now in a certain state...
and I want to change that state.. where do you do that?"*

The answer is "mostly you do not — you record the thing that moves them", and
that is the design. But **nowhere in the app says so while you are looking at a
person.** The settings screen explains what earns each band; the person's own
surfaces explain nothing, so the reasonable conclusion from the interface is
that the control is hidden somewhere.

What the page should carry, per axis: where they sit, and the one sentence
about what would move them — which already exists as `BAND_NOTE_KEYS`, written
for the settings screen and never shown anywhere else. Plus the two that ARE
answerable, pointed at their real home: closeness is the card in the popup, and
opportunity is the deal's stage in Pulse.

Belongs with §1.1 rather than beside it: this IS the header of the person's
page.

### 1.4 Tags grow and nothing prunes them
**Shipped v0.73.61** — Settings → Tag cleaning (ask 60). What follows is the reasoning it was built on.

Tags are detected while writing (v0.73.10) and organisations are tags. There is
a tag cloud and a tag filter, and no way to rename, merge or delete a tag.
A vocabulary that only grows is a vocabulary that stops meaning anything —
`#retreat`, `#retreats` and `#Retreat` will coexist within a month of real use,
and §3.5's rarity rule then reads three weak links where there is one strong
one. The hygiene sweep finds duplicate PEOPLE; it says nothing about duplicate
words.

---

## 2. Next

### 2.1 Second-degree names on the map
The last behaviour from the Visual Thesaurus reference that was never built:
names of the names, further out and fainter, so the cloud shows a neighbourhood
rather than a star. Sjoerd, 2026-09-13: *"It is great to see the next amount of
names with a opacity very far in the cloud."*

The layout already supports it — `targetRadius`, per-node opacity and the
junction grammar all generalise. What does not exist is the read: the
neighbourhood function answers for one person, and this needs the neighbours of
each neighbour, which is either a second round trip per name (no) or one
function that returns two rings (yes).

### 2.2 The overview's clusters
Placement in the dot overview is a plain hash of the id, so people who belong
together are not placed together. `connections-desktop.md` §5c resolves it with
a nightly snapshot. Named as a gap in the UI rather than faked.

### 2.3 An organisation is a popup and nothing else
`OrgPopupProvider` opens a company from the map centre and connects people to
it. There is no `/organisations` list, no `/organisations/:id` page, and the
popup says so by deliberately not offering an "open the full page" link. For a
community app that may be right; for anyone who thinks in institutions it is a
hole. Decide before adding more into the popup, because a popup that grows a
third section is a page that has not admitted it yet.

### 2.7 The meetings you have had with this person
Sjoerd, 2026-09-13: *"if you have appointments in your calendar with this
person, that in an extra tab you see an overview of your meetings?"*

**Half of it is nearly free.** A meeting booked through Meet is platform data
and already writes an activity event, so it lands in the person's stream (§1.1)
with no new integration at all. The same is true of threads attended. If "your
meetings" means "the times we have actually met", a good part of the answer is
already in the database and simply has nowhere to be shown.

**The Google calendar half needs a decision, because the read is
forward-only.** `connections-agenda.ts` asks Google for 1–14 days AHEAD, live,
and stores nothing — deliberately: it exists to answer "who is my day about",
and a scan that persisted everything it saw would have been a much bigger
decision made in passing. So "meetings we have had" cannot be answered from it
as it stands.

Two ways, and they trade the same thing against each other:

1. **Ask on demand.** When a person is opened, query their calendar over the
   last N months and filter to events carrying that person's email. Nothing is
   stored, no new body of personal data, and it stops working the moment the
   Google token lapses. The cost is real: the Calendar API cannot filter by
   attendee, so this fetches a window and filters in memory — a year of
   somebody's calendar, every time a popup opens.
2. **Keep what the scan sees.** A row per (person, event, when). Fast, gives
   history, survives a lapsed token — and creates a permanent record of every
   meeting you have ever had with everyone, in a database that **has never
   deleted anything** (§3.4, D69 unanswered). That is not a reason to refuse
   it; it is a reason not to build it before there is a retention answer.

**And one scoping question that changes what the tab means.** The calendar is
per USER — the route reads only the signed-in person's own calendars, on
purpose, because "who is in your day" is not a workspace-level fact. So a
meetings tab built on the calendar shows YOUR meetings with them. Activity
events show the whole team's. For a community organisation "has anyone here met
them" is usually the more useful question, and it is the one already answerable.

Recommendation: build the activity side with §1.1 and see whether the calendar
half is still wanted once "every time anyone here met them" is on the page.

### 2.6 Naming a target the workspace has never heard of
The other half of §1.3. "Can we reach Acme?" is the question Entries exists for,
and it cannot be asked about an Acme with no row.

Three shapes, increasing in cost and in mess:
1. **Create the organisation from the search box** when nothing matches — one
   field, and it lands a real `organisation` row. Cheap, and it fills the
   database with half-known companies somebody typed once, which is the
   failure mode the hygiene sweep then has to clean up.
2. **A target that is not a record** — a string you asked about, kept only as
   a question. Answers nothing better than (1) does, because the degrade needs
   a sector or a country to match on and a typed name carries neither.
3. **Ask for the one fact the degrade needs**: name plus sector (or country).
   Then a stranger gets a real answer — "three people you know work in that
   sector" — which is the whole point of the degrade, and the row is worth
   keeping because it carries more than a name.

(3) is the only one that makes the feature work for a stranger, and it is
barely more interface than (1).

### 2.5 Three controls, one rule — needs Sjoerd's answer
Sjoerd, 2026-09-13, looking at the card that had just shipped: *"What does KEY
CONTACT and SPEAKS FOR US mean?"*

Checked rather than recalled. Between them, `is_key_contact` and
`is_ambassador` have exactly ONE effect in the whole system: either flag — or a
closeness of `advocate` — puts somebody on a ninety-day leash
(`ambassador_drifting` in `connections_attention`), so they come up in
Attention if nobody has spoken to them in that time. Nothing else reads either
column: no filter, no axis, no list, no report.

So the card has **three controls that do the same thing**. The only difference
they make is the sentence in the attention queue — "flagged as an ambassador"
versus "flagged as a key contact" — which is a label, not a behaviour.

That is a question about what the workspace means, not a bug to fix quietly.
Three honest answers:

1. **They are one thing.** Keep `advocate` on the closeness axis, drop both
   checkboxes. Fewest controls, and closeness is already the human judgement.
   Costs the distinction between "close to me" and "speaks for us in public",
   which are genuinely different for a community organisation.
2. **They are different things and should behave differently.** An ambassador
   is someone who represents you to others; a key contact is your way INTO an
   organisation. Different thresholds (an ambassador going quiet is more
   urgent), and a key contact probably belongs on the `org_membership` row
   rather than on the person — it is a fact about a relationship to a company.
3. **They are labels and that is fine.** Keep both, purely so the attention
   queue can say WHY. Cheapest, and the interface should then stop implying
   they are two decisions.

Until it is answered the card says what they actually do, in one line, rather
than two different-sounding descriptions of one switch.

### 2.4 Working hours
Free time assumes Monday–Friday, 09:00–17:00, in the profile timezone. Worth a
setting the first time somebody who works weekends uses Today. All-day holidays
should probably remove the day entirely.

---

## 3. Needs a decision before it can be built

### 3.1 A place is not a thing
Sjoerd, 2026-09-13: *"Can you also create a cloud around a location - space...
or tag?"* Tags now work as a centre; **locations do not exist in this data
model at all**. An engagement carries `location` (one line of text) and
`location_url`; there is no venue entity, so "the room we always use" has no
home and its practical details get retyped per session. The same gap is already
open platform-wide in `build-plan.md`. Until it is filled, a place is a tag like
any other word — which is workable, and should be said out loud rather than
quietly implied.

### 3.2 The last axis without history
`relationship_strength` is a current-state column, so `closeness` reports
proportions truthfully and no movement — correctly, because we genuinely do not
know that anybody moved. The fix is the one `pulse_commitment_stage_event`
already answered for deals: a change log, a trigger, an honest backfill. Worth
doing once §0 exists and people are actually rating each other; pointless
before.

### 3.3 Axes a workspace invents
v0.73.37 made the titles and the visibility of the five axes the workspace's
own. "How many" is half-answered: you choose how many of the five you read, not
whether there is a sixth.

A sixth needs a rule, and a rule a workspace writes is a rule a workspace has
to maintain — the failure `connections-model.md` was written to avoid. There is
an honest shape already in the codebase: `closeness` is RATED rather than
derived, and tells the truth about it (`unrated` is a visible band, and it
claims no movement). A user-defined **rated axis** — a name, its bands, set by
hand — invents no rules and lies about nothing. A user-defined **tag axis**,
whose bands are tags, is derived from real data and needs no predicate language
either. What should stay unbuilt is a rule builder.

### 3.4 Retention (D69)
`retention_policy` exists and is referenced by nothing. This database has never
deleted anything. A hygiene procedure without a retention half is tidying the
surface of something that keeps getting heavier. The policies are a business
decision, not an engineering one.

### 3.5 Still open from the overview
D11 Microsoft calendar · D21 audience as saved query or list · D27 which
lifecycle rungs are real (partly resolved 2026-09-12: the NAMES are the
workspace's, the rules stay derived) · D41 relationship edge types fixed or per
workspace · D57 stitch or knot.

---

## 4. Debt and risk

### 4.1 Five functions still reachable with the anon key
`can_see_person`, `can_see_activity`, `can_see_organisation`,
`meet_is_team_lead`, `workspace_meet_fee`. Platform-wide rather than
Connections-only, and deliberately not swept up with the identity functions on
2026-09-13: four are RLS helpers evaluated as `authenticated` inside row
policies, so a blanket revoke would blank the app for every signed-in user.
Each needs its body read — if it answers about the CALLER, revoke `anon` and
move on; if it takes the target as a parameter, it is a real leak needing a
redesign.

**And the standing guard**: the calibrated probe (malformed uuid as anon,
`42501` closed, `22P02` open) as an integration test over every SECURITY
DEFINER function, with a reviewed allowlist. Every function written since May
was "locked" the wrong way by careful authors. A handbook rule did not stop
that; a failing test would.

### 4.2 What the 2026-09-13 sweep covered, so the next one need not
- **Stuck spinners**: every `use client` file awaiting a server action was
  audited. Five bare sites found and fixed through `lib/safely.ts` (v0.73.41).
  The pattern to keep: a failed CALL becomes a failed RESULT.
- **Tenant filters**: every `adminClient` chain in the connections routes was
  checked for one that names no workspace. Three reads of `person` were scoped
  only by id — all fed by workspace-scoped functions, so hardening rather than
  a live leak, and `peopleByIds()` now requires a workspace.
- **Checked and sound**: no N+1 (the one await-in-a-loop is a two-attempt
  degrade); every read without a `.limit()` is an `.in(ids)` lookup over an
  already-bounded, workspace-filtered set.

### 4.3 Untested surfaces
The map's physics and the crossfade have real tests (`web-layout.test.ts`,
`focus-web.test.ts`), mutation-checked. The routes do not: there is no
integration test that the neighbourhood, the tag cloud or the landscape return
what they claim against a seeded workspace. `scripts/seed-staging-connections.mjs`
already builds the fixture, so the missing piece is the assertions.

### 4.4 Two things that are true and undocumented elsewhere
- `CLAUDE.md` still says Connections "is **not** registered in the catalogue
  yet". It is — the app gates on `fibre-sales` membership plus workspace
  activation and it works, so the line is stale.
- The Connections staging Vercel project has no sibling URL env vars. Harmless
  since `branding.ts` derives them from the host, but it will read as a
  mystery to whoever looks next.

---

## 5. What NOT to build

Kept because each was considered and rejected for a reason that will recur.

- **A rule builder for the landscape.** §3.3.
- **Co-occurrence as a relationship.** Two people carrying one tag is not a
  tie (handbook §12). The map may draw them near each other; nothing may
  compute on it.
- **A person list on the phone.** Removed deliberately: the phone is capture
  and triage, and a full directory on a device that leaves the building is
  the wrong trade (v0.73.22).
- **Matching a name in prose to a person.** `detectTags` must never see the
  people array. `@` is intent; a matcher is a guess that lands a claim on a
  real person's record.
