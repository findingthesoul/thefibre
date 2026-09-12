# The desktop landscape: an orbit, not a hairball

*Written 2026-09-11, from Sjoerd's description: a web of connected people; the
active ones bigger, the ones you have an appointment with bigger and bolder, the
ones you have not seen far removed; click a person to zoom in and get their
information while others in similar condition appear around them; a popup with
actions, relations and a timeline where encounters can be added and meetings
planned; close and it autosaves; zoom further in to relations — colleagues,
friends, villagers, gave a lead, introduced X, bought Y — or further out.*

*Companion to [`connections-model.md`](connections-model.md) (what the
landscape is made of) and
[`connections-mobile.md`](connections-mobile.md) (the mobile
surface). **This revises the "not a node graph" rule in that document.***


> **Naming (decided 2026-09-11):** the surface is called **Connections**. The
> words *landscape*, *map*, *cloud* and *lens* throughout these documents are
> thinking language, not product language — Thread carries the metaphor for this
> platform and everything beside it says what it is. See
> [`connections-naming.md`](connections-naming.md) §5.5.

---

## 1. What I got wrong

I wrote: *not a node graph — the force-directed hairball is the standard mistake
in this category; it demos well and answers no question.* That is true of the
thing I was picturing and false of the thing you are describing, and I dismissed
a category when I should have dismissed one implementation of it.

The difference is not cosmetic. It is two properties:

**Yours is egocentric.** You are the centre. Distance means something about
*your* relationship to a person, not about abstract network topology. A
sociocentric graph — everyone floating, connected to everyone — has no origin,
so position carries no meaning and the eye has nowhere to start. That is the
hairball.

**Yours is encoded.** Size means activity. Bold means an appointment is coming.
Distance means time since contact. In the hairball, position is an artefact of a
physics simulation settling, and it means nothing at all — which is exactly why
it answers no question.

An egocentric, encoded layout is not a network diagram. It is closer to a radar
screen, and radar is a good interface. So: the mobile document's rule stands as
written only for the sociocentric case, and this document replaces it.

---

## 2. The move that makes it work: angle is identity, radius is recency

The single hardest problem with any spatial view of people is **stability**. If
positions shuffle every time the data changes, you can never build spatial
memory, and spatial memory is the entire reason to use a spatial view. Force
simulations are famously unstable — add one node and the whole picture
rearranges. That alone disqualifies them here.

So do not simulate. Place deterministically in polar coordinates:

- **Angle is stable identity.** Fixed per person, derived from something that
  never changes — first contact date, or organisation, or simply a hash. A
  person occupies the same bearing today as last month.
- **Radius is time since last personal contact.** Near the centre: spoken to
  recently. Far out: gone quiet.

The consequence is the good part. **People drift outward as you neglect them,
and snap inward the moment you speak.** The picture animates over time in a way
that is both literally true and emotionally right for a facilitator: you watch
relationships receding. Nothing else on the screen has to explain what "far
removed" means.

Angle can also be *grouped* rather than arbitrary — sectors for organisations,
or for communities, or for the axes in the mobile document. Then a sector going
uniformly pale tells you a whole community has gone quiet, which is a finding no
list would ever surface.

---

## 3. The encoding budget, and where it runs out

You named several conditions: active, important, has an appointment, marked as
a lead, new, long time no contact. That is more conditions than a single view
can carry, and pretending otherwise is how these things become unreadable.

A spatial view has roughly four channels before it collapses:

| Channel | Carries | Why |
|---|---|---|
| **Radius** | time since contact | Continuous, and the metaphor is free |
| **Size** | attention needed now | Pre-attentive; big things are seen first |
| **Weight / halo** | imminent — an appointment coming | Boldness is the right register for "soon" |
| **Colour** | one categorical axis, chosen by the user | Maturity, or opportunity stage, or closeness |

**Everything else becomes a filter, not an encoding.** New, lead, ambassador,
unpaid: these are switches that dim or reveal, and the picker at the top is the
same picker as the mobile axes. That is what keeps the two surfaces one product
rather than two.

The rule underneath: if a condition cannot be read at a glance from across the
room, it is not an encoding. It is a filter.

---

## 4. Density — the part that will actually break

> *Amended by §5c: the aggregation below is right, but it should render as haze
> rather than a labelled band. Decision D46.*

With a vast network the outer rings hold most of the population. Hundreds of
people you have not spoken to in a year, rendered as hundreds of dots, is a
grey band that means nothing and costs everything to draw.

**Aggregate the far field.** Beyond a threshold radius, people stop being dots
and become a band with a count: *"312 people, no contact in over a year."*
Tapping it opens a list, not a cloud. The centre is individuals because
individuals are actionable; the periphery is a quantity because a quantity is
the honest summary of it.

This is also what makes the view usable on day one and at scale, which is
otherwise hard to have both of.

---

## 5. Semantic zoom: four levels, each showing different things

Zoom here is not magnification. Each level answers a different question, which
is what makes "zoom further in" mean something.

**Out — the whole community.** Sectors and rings, the far field aggregated.
Answers: what shape is my community in, and which parts have gone pale.

**Mid — a neighbourhood.** Focus a person and the view re-centres on them, with
context around. *One thing to decide here* — see D40: the surrounding people
can be **others in the same condition** (also gone quiet, also new) or **their
actual relations**. Your description reads as the first; the "zoom further in to
relations" step reads as the second. Both are useful and they are different
builds.

**In — the person.** The popup: who they are, the timeline, actions, add an
encounter, plan a meeting, participation in threads, what they have paid.

**Further in — their relations.** Typed edges: colleagues, friends, villagers,
who introduced them, who they introduced, what they bought. This is the
`relationship` table finally doing its job.

Closing any level returns to the one above, autosaving on the way out — which is
the capture rule already agreed
([`connections-data-integrity.md`](connections-data-integrity.md) §7.1), just
applied here.

---

## 5b. Relatedness — how the neighbourhood is chosen

*(Added 2026-09-11. Sjoerd, answering D40: "they should be related — for example
directly, or 1 or 2 characteristics between them. Relations could be shared
contact (person, company), but also other characteristics like industry or
locality, stage of pipeline.")*

This dissolves the fork rather than picking a side, and it is the better answer.
The neighbourhood is people who are **related**, where relatedness is *computed
from shared attributes* and not only from typed edges.

**Why it is better: it solves the cold start.** `public.relationship` is empty
and has been since phase 0. If edges must be asserted by a human, this view is
blank for a year and nobody ever fills it, because filling it has no reward
until it is already full. Attribute-derived edges exist on day one, from data
Fibre already holds.

### The rule that makes it work: rarity is the weight

Shared attributes explode combinatorially, and this is the one way this design
fails badly. If "same country" is an edge, then two hundred Dutch contacts
produce nineteen thousand nine hundred edges — a clique, not a graph. Slow to
compute and meaningless to look at.

The fix is a single principle:

> **An attribute's weight is inverse to how common it is in this workspace.**

Sharing something three people have is a strong link. Sharing something three
hundred people have is not a link at all. Shared *Netherlands* in a Dutch
organisation tells you nothing; shared *attended the Athens 2026 board session*
tells you almost everything.

This is worth stating as a rule rather than a tuning parameter because it
**adapts per workspace with nothing to configure**. A workspace where everyone
is a facilitator gets no edges from "facilitator". A workspace where one person
is gets a strong one. No thresholds in settings, no per-customer tuning, and it
stays correct as the data grows.

### Two hops, capped

"One or two characteristics between them" means a second hop is allowed: both
connect to a third person or thing. Full two-hop expansion over an attribute
graph is where performance dies. Cap it — take the top N neighbours by weight at
each hop, never the whole frontier. The second hop is for finding the
non-obvious link, and the non-obvious link is by definition a high-weight one.

### Every derived edge states its reason

A line between two people with no explanation is the creepy version of this
product. It is also the useless version, because the reason is the part a
facilitator actually wants: *"both at the Athens board session", "both
introduced by Marja", "both work in cooperative housing"*. That sentence is the
conversational hook, and it is the entire value of the edge.

So: no unexplained edges, ever. Hovering or focusing one says why it exists.

### Typed and derived stay visibly different, and only typed are stored

*"Marja introduced Daniel"* is an assertion a human made. *"Marja and Daniel
were both in Athens"* is an inference Fibre drew. Rendering them identically is
a lie that compounds quietly.

This makes decision **D26** — derived edges are displayed, never stored —
load-bearing rather than hygienic. Most edges in this view are inferences about
relationships between two people, only one of whom is looking. Computing them at
read time and keeping nothing is what keeps the feature defensible under a
subject access request, and it costs nothing because the computation is cheap
and the result is ephemeral anyway.

### What is actually available

All of this is live in the schema today:

| Attribute | Source | Typical strength |
|---|---|---|
| Same thread or session, small one | `thread_enrolment`, `enrolment` | **Strongest** — they were in a room together |
| Same organisation | `org_membership` | Strong |
| Same introducer | `person_relationship_context.introduced_by` | Strong, and almost never noticed |
| Shared expertise or certification | `person_professional.expertise_areas`, `certifications` | Strong — these are rare by nature |
| Shared industry or sector | `person_professional.sector`, `industries_worked_in` | Medium; depends entirely on workspace concentration |
| Shared tag | `person_tag` | However rare the tag is — the rule handles it |
| Same city | `person.city` | Medium. Same *country*: usually worthless |
| Shared language | `person.languages_spoken` | Usually worthless — the rule will zero it out on its own |

That last column is why rarity-as-weight matters: **the same rule ranks all of
them, so the list above needs no curation and no per-workspace judgement.**

### One I would push back on: pipeline stage

You listed stage of pipeline as a relation. I do not think it is one. Two people
both sitting at *proposal* are not related to each other — they are in the same
bucket. Treating a shared bucket as an edge would connect strangers and, worse,
would swamp the real edges, because stage is a low-cardinality field and
low-cardinality fields are exactly what the rarity rule exists to suppress.

Stage is already carried better elsewhere: it is one of the colour axes (§3) and
one of the filters. Keep it there.

### Where the encoding budget comes back

Section 3 said four channels and no more. That was about the full view with
hundreds of people. **In the neighbourhood, showing perhaps a dozen, the budget
resets** — there is room for edge colour, edge labels and the reason text.
Different kinds of relatedness must be distinguishable here, or the view implies
a sameness between "co-facilitated for three years" and "both in Utrecht" that
is simply false.

---

## 5c. A cloud, not a dartboard

*(Added 2026-09-11. Sjoerd: "think of a cloud… and different views a person can
choose about the nature of relations. The more you select, the thinner the
landscape.")*

### The geometry should be invisible

Section 2 proposed polar placement, and I described it in a way that would build
a dartboard — visible rings, hard sectors, a radar grid. That is the wrong
**appearance**, and the maths is not what made it wrong.

Keep the determinism, drop the geometry. Placement stays computed rather than
simulated, because stability is what lets you learn where people live. But
nothing on screen announces it: no ring lines, no sector borders, jitter within
each band so the eye reads density rather than a lattice, and radius as a
gradient instead of discrete steps. A person's distance is felt, not measured.

### Clusters are the point of a cloud

The stronger reading of "cloud" is not softness, it is **clumping**. In an
attribute-derived graph, clusters form on their own wherever relatedness is
dense — and a clump you did not know about is a real finding: a
community-within-the-community, a group of people who all know each other
through something you have forgotten.

That creates a genuine tension with §2, and it is worth naming rather than
smoothing over:

- **Stability** wants a person's position fixed, so you can build spatial memory.
- **Clustering** wants position to respond to who they are near.

**The resolution is the snapshot.** Clusters are computed on a schedule — the
same nightly pass that already produces the aggregate (D35) — and a person's
cluster becomes their region of the cloud. Within a cluster, radius is still
recency. So clumps mean something *and* the picture does not rearrange every
time you blink, because the layout only moves when the snapshot does.

### The far field becomes haze

Section 4 proposed aggregating distant people into a labelled band. A cloud
gives a better answer: **the periphery is literally mist.** Density rendered as
fog, thickening where more people sit, with a count floating in it — *"312
people, no contact in over a year"* — and a click that opens a list.

Same behaviour as the band, better metaphor, and it removes the hard line
between "people we draw" and "people we summarise" that would otherwise be a
visible and arbitrary edge in the picture.

### One tension to hold, not resolve

The lifecycle rungs in [`connections-model.md`](connections-model.md) §3.1
are discrete — touched, attended, returned, contributor. A cloud says the
transitions are continuous. Both are right for their purpose: **the rung is the
bucket you count in, the position is the continuous truth.** The mobile bands
need discrete buckets because you cannot count a gradient; the cloud needs a
gradient because nobody crosses from "attended" to "returned" at a moment. Do
not force one to become the other.

---

## 5d. Thinning: the filter runs backwards

*"Different views a person can choose about the nature of relations. The more
you select, the thinner the landscape."*

This is the interaction model, and it inverts the usual convention. Most filter
interfaces start narrow and widen as you tick boxes — each selection is another
thing included. Here you **start with the full cloud and carve away.** Each
selected relation type is a *requirement*, not an addition, so every tick makes
the picture sparser and the surviving links stronger.

**Say this out loud to whoever builds it**, because the naive implementation
does the opposite. Ticking "shared organisation" and "shared session" in a
normal filter draws org edges *plus* session edges — more lines, denser view.
What is wanted is edges that satisfy **both**: people who share an organisation
*and* sat in a session together. Intersection, not union.

### Thinning and the rarity rule are the same thing

This composes beautifully with D43. Intersecting two attributes produces a
rarer combined attribute, and rarer means higher weight. So **thinning by hand
is the rarity rule applied deliberately**: as you add requirements, the links
that survive are automatically the ones the weighting would have ranked highest
anyway. The user is not fighting the algorithm, they are steering it.

That is also the answer to "what is this for". The full cloud is for noticing.
Thinning is for asking a specific question — *who do I know who is both in this
sector and came to something of ours* — and getting to a handful of people you
could actually call.

### Two build consequences

**Thinning must be instant, so it cannot be a server round trip.** Load the
neighbourhood once with every edge and every edge's reason attached, then filter
in the browser. A checkbox that takes 400ms to redraw destroys the exploratory
feel that is the entire point.

**The default state must be beautiful.** If the picture only becomes legible
after three selections, most people never see a good version of it. The full
cloud is what everyone sees first and it has to work as-is — which is what §4's
haze and §5c's clustering are for.

---

## 5e. Visual Thesaurus — and two layouts for two scales

*(Added 2026-09-11. Sjoerd offered thinkmap's Visual Thesaurus as the visual
reference.)*

It is a good reference, and taking it seriously resolves a tension I had left
standing.

What that interface actually does: a word sits at the centre, related words
radiate out on springs, **clicking a word re-roots the whole graph and it
animates smoothly into its new arrangement**, and edge colour carries the *kind*
of relation — synonym, antonym, part-of. You do not feel like you are loading
pages. You feel like you are travelling through a space.

The re-rooting animation is the important part, and it is the thing that makes
"zoom further in" from §5 feel like one continuous object rather than four
screens.

**But it is a force-directed layout, which §2 rules out.** That contradiction is
real and the resolution is that the rule was over-general:

| Scale | Layout | Why |
|---|---|---|
| **The whole community** — hundreds or thousands | Deterministic, stable, clustered by the nightly snapshot | You need spatial memory; a picture that rearranges cannot be learned |
| **A neighbourhood** — ten to thirty | Spring/force, animated, re-rootable. Visual Thesaurus | Nothing to memorise, because you re-root constantly. Instability becomes *motion*, which is the point |

Instability is a defect at scale and a feature up close. Visual Thesaurus works
precisely because it never shows more than about thirty nodes — the same bound
that made the encoding budget come back in §5b. So: **the cloud is computed, the
neighbourhood is simulated, and moving between them is an animated transition
rather than a navigation.**

Visual Thesaurus also confirms the edge-colour-by-relation-type point from §5b
independently. There it distinguishes synonym from antonym; here it distinguishes
*co-facilitated for three years* from *both live in Utrecht*, which is a larger
difference and matters more.

One thing not to copy: Visual Thesaurus has one relation vocabulary and it is
fixed by the language. Here the vocabulary is partly emergent and partly
user-made (see [`connections-model.md`](connections-model.md) §3.5), so the
legend is generated, not drawn.

---

## 6. Two things this needs from elsewhere in the repo

**The popup is the existing profile, not a new component.** Fibre web already
has a contact profile with an identity tab and per-app tabs that appear because
the data does. Building a second person view inside the landscape would be
exactly the fork the components-first rule exists to prevent. The popup should
render the shared profile, and if it needs to be more compact, that compactness
belongs in the shared component so every app gets it.

**The edge vocabulary needs widening.** `relationship.type` is a check
constraint today: `introduced_by | co_facilitates | referred | colleague | peer
| mentor`. "Friends" and "villagers" are not in it, and villagers in particular
is a soul.com concept rather than a generic one. That is a migration and, more
importantly, a question about whether edge types are fixed by the platform or
defined per workspace. Fixed is simpler and stays honest; per-workspace is
flexible and becomes an unmaintained taxonomy within a year. I would fix them,
after widening the list once with you.

**On rendering:** `@xyflow/react` is already a dependency in Flow, and the team
has shipped a canvas with it. It is DOM-based, so it is comfortable into the low
thousands of nodes and not beyond — which, combined with far-field aggregation
in §4, is enough for a long time. Worth reusing rather than introducing a second
graph library.

---

## 7. How this sits with the mobile surface

They are not competing designs. **One model, two representations, and the form
factor decides:**

| | Mobile | Desktop |
|---|---|---|
| Form | Bands and a queue | Orbit and a popup |
| Good at | Triage, glance, capture | Exploration, noticing, context |
| Question | Who needs me today | What is the shape of this, and who is drifting |
| Axes | The picker re-segments the bands | The picker re-colours and re-filters the orbit |

The axis picker being literally the same control in both is what makes them one
product. Neither is the real one; you would use the phone between meetings and
the desktop on a Monday morning.

*(Sharpened 2026-09-11 — Sjoerd: "landscaping is different than input of a quick
direct view, so the combo makes the work more possible." **The activity decides
the surface, not the screen size.** Landscaping is a thinking activity, so it is
desktop-first; capture and triage are ten-second activities, so they are
mobile-first. Neither is a degraded version of the other, and this is not
responsive reflow — they are different tools for different moments in the same
work. See [`connections-overview.md`](connections-overview.md) §5.5.)*

---

## 8. What I would be careful about

**This is the most seductive thing in the whole exploration, and seduction is
the risk.** A view like this is very satisfying to build and very easy to keep
polishing, and it produces nothing until the data underneath it is real. It
depends on conversations being logged, edges being written, and cadence having
history to measure. Built first, it is a beautiful empty room.

The order that protects it: the conversation log, the derived lifecycle, the
attention conditions, and the relationship edges all have to exist and have
weeks of data in them. Then this view becomes the payoff for all of it — and it
will be genuinely striking, because almost nobody has the data to draw it.

**And the language rule from the landscape doc applies double here.** A screen
showing people receding from a centre, sized by how much they are worth to you,
is one bad label away from feeling like a targeting display. It should read as
*noticing*, not *managing*.

---

## 9. Decisions

**D37 — Desktop gets a spatial view; the earlier "no node graph" rule is
narrowed to sociocentric force layouts.** *Recommended: yes.* Egocentric and
encoded is a different object and a good one.


**D38 — Deterministic layout at community scale; spring layout in the
neighbourhood.** *(Amended twice on 2026-09-11 — see §5c and §5e.)* Placement is computed, not simulated, because stability is what makes a
spatial view worth learning, and drift-as-neglect is a true and legible
animation. But no rings, no sectors, no grid: jitter within bands, radius as a
gradient. Cluster regions come from the nightly snapshot, so clumps mean
something without the picture rearranging between visits. *Recommended: yes.*


**D39 — Four encodings, everything else is a filter.** Radius, size, weight,
one user-chosen colour axis. *Recommended: yes.*


**D40 — RESOLVED (Sjoerd, 2026-09-11): related, where relatedness is computed
from shared attributes, not only typed edges.** See §5b. This dissolves the fork
and solves the cold-start problem that would otherwise leave the view empty for
a year.


**D41 — Are relationship edge types fixed by the platform or defined per
workspace?** *Recommended: fixed,* after widening the current six with you.
Per-workspace taxonomies go unmaintained.


**D42 — Build this last, not first.** *Recommended: yes,* and stated as a
decision precisely because it is the one thing here anyone would be tempted to
start with.


**D43 — An attribute's weight is inverse to its frequency in the workspace.**
The one rule that stops shared-attribute edges collapsing into cliques, and it
adapts per workspace with nothing to configure. *Recommended: yes* — without it
this design fails on the first real dataset.


**D44 — No unexplained edges.** Every derived link states why it exists. It is
both the safeguard and the actual value — the reason is the conversational hook.
*Recommended: yes.*


**D45 — REVISED (2026-09-11): pipeline stage is a characteristic, but never a
default edge.** My original objection was that a shared low-cardinality bucket
connects strangers and swamps the real links. That holds only for edges drawn
*by default*. Under intersection-thinning (D47) it stops being a problem and
becomes a strength: stage alone draws nothing, but *"at proposal stage AND shares
a sector"* is a rare, meaningful combination and exactly the question worth
asking. The rarity rule already produces this behaviour with no special-casing —
low-cardinality attributes carry near-zero weight alone and gain it in
combination. So stage stays in the characteristic vocabulary, stays a colour
axis, and is simply never the sole reason a line is drawn. Sjoerd was right and
the mechanism was already in place.

**D46 — The periphery is haze, not a band.** Density rendered as fog with a
count in it, clicking through to a list. *Recommended: yes* — same behaviour as
the labelled band, and it removes an arbitrary visible edge between the people
we draw and the people we summarise.

**D47 — Thinning is intersection, not union.** Each selected relation type is a
requirement; more selections means fewer, stronger links. *Recommended: yes,*
and it must be written into the ticket, because the obvious implementation does
the opposite and will look like a bug that is actually a misreading.

**D48 — Thinning happens in the browser.** The neighbourhood loads once with
every edge and reason; filtering never round-trips. *Recommended: yes* — a
checkbox with latency kills the exploratory feel this view exists for.

**D49 — Discrete rungs and continuous position coexist.** The rung is the bucket
you count in on mobile; the cloud position is the continuous truth. *Recommended:
yes* — do not force either to become the other.
