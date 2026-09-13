# Inbox

Sjoerd's gathering box. Raw items, captured as they arrive, from any chat.

**This is not the queue.** `docs/build-plan.md` is the queue and it claims to
be in priority order. Dropping unranked items into it breaks that claim
quietly. Items land here first, get ranked later, then move.

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

## Moved out

_Items that graduated to `docs/build-plan.md`, with the date and destination._
