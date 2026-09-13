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

## 0. The sharp one: an axis nobody can fill

**The landscape has five readings. One of them cannot be answered from inside
this app.**

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

**What to build:** the relationship card in the person popup — strength, how
you met, who introduced them, whether they are a key contact. Reading is a
`GET`, writing is a `PATCH`, both exist. The only design question is how much
of it belongs in a popup versus the person's page, and the answer is probably
"strength and introduced-by in the popup, the rest on the page", because
strength is the one somebody will want to set in the three seconds after a
conversation.

**Watch out for:** `introduced_by` is a person id, so its control is a person
picker and not a text field (handbook §12). And `relationship_strength` has no
history — see §3.2.

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

### 1.3 Tags grow and nothing prunes them
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
