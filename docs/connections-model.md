# The landscape: where everybody is, and who is drifting

*Written 2026-09-11, from Sjoerd: "one of the most important things for
facilitators is to create a landscape. Like, where is everybody… what requires
attention… what is relationships with others… when does it need moving. More
than sales it is about increasing the closeness to the community."*

*This reframes the Simple Sales series
([exploration](connections-what-exists.md), [landscape of other
CRMs](connections-market.md), [calendar](connections-calendar.md),
[data integrity](connections-data-integrity.md),
[newsletter](connections-newsletter.md)). **The pipeline is a special case of
this, not the other way round.***

> **Surface design:** [`connections-mobile.md`](connections-mobile.md)
> (mobile) and [`connections-desktop.md`](connections-desktop.md)
> (the orbit view).
>
> **Mobile surface:** [`connections-mobile.md`](connections-mobile.md)
> covers how this is actually seen — the shape vs the queue, one visual with five
> axes, what's next vs what to prepare, the today/tomorrow/this week/next week
> horizon, and the mobile-first rules. Decisions **D31–D36**.


> **Naming (decided 2026-09-11):** the surface is called **Connections**. The
> words *landscape*, *map*, *cloud* and *lens* throughout these documents are
> thinking language, not product language — Thread carries the metaphor for this
> platform and everything beside it says what it is. See
> [`connections-naming.md`](connections-naming.md) §5.5.

---

## 1. The reframe, and why it is right

The market analysis found that Fibre's users are stewardship-shaped rather than
velocity-shaped: relationships held over years with no single close moment,
measured by retention and cadence rather than deal speed. That was the correct
observation and the wrong conclusion — I treated it as a reason to *reorder the
sales build*. It is actually a reason to build something else, with sales as one
view of it.

A facilitator's real question is not "which deals will close". It is **"where is
everybody, and who needs me"**. That question has no product. Pipedrive cannot
answer it because it only knows deals. A nonprofit CRM half-answers it, in
donation terms. Nothing answers it in terms of *participation* — who came, who
came back, who brought someone, who has gone quiet.

Fibre can, and the reason is structural: it holds identity, participation,
money and delivery in one system. That is not a feature advantage, it is the
only reason this view is computable at all.

---

## 2. The graph is already in the database, and nothing uses it

`public.relationship` has existed since the very first migration, phase 0. It
is a typed person-to-person edge table:

```
from_person_id, to_person_id
type      ∈ introduced_by | co_facilitates | referred | colleague | peer | mentor
strength  ∈ weak | warm | strong | advocate
notes
```

**Nothing writes it. Nothing reads it except the GDPR Article 15 export.** No
UI, no API route, no seed. The community graph was modelled on day one and then
left dormant for four months.

Around it, live and in use:

| Material | Table | State |
|---|---|---|
| Who introduced whom | `person_relationship_context.introduced_by` | Live, editable in the web relationship tab |
| How close | `person_relationship_context.relationship_strength` (weak/warm/strong/advocate) | Live |
| Who matters | `is_key_contact`, `is_ambassador` | Live |
| Where they are in a process | `flow_run.current_step_id` + `current_step_entered_at` | Live, and Flow's board already renders it |
| What happened | `activity` — append-only, type + subject | Live |
| What they came to | `enrolment`, `thread_enrolment` | Live |
| What they paid | `purchase` | Live |
| Whether they are a member | `membership_member.status` (active/grace/lapsed/cancelled) | Live |
| Which organisation | `org_membership`, `org_relationship` | Live, mostly unwritten |
| Labels | `tag`, `person_tag` | Live |

**The landscape is a read, not a schema.** Almost nothing here needs a new
table. What it needs is a view, and the discipline described in §4.

---

## 3. Sjoerd's four questions, answered concretely

### 3.1 "Where is everybody" — a lifecycle, derived

Not a graph. A board, the same shape as Flow's kanban, but showing a person's
**standing in the community** rather than their position in one process:

> never engaged → touched → attended once → returned → contributor →
> facilitator → dormant

Two rules make this work.

**Derived, never typed.** Nobody hand-maintains four hundred people's stage.
Every step above is computable from tables that already exist — `activity` for
touched, `thread_enrolment` for attended, a second enrolment for returned,
`membership_member` or `purchase` for contributor, `thread_thread_organiser`
or `flow_task` assignment for facilitator, silence for dormant.

**Nothing to fill in.** This matters more than it sounds. Every other surface in
this series asks the user for something. The landscape asks for nothing and
gives something back on the first day it exists — which, per the adoption data,
is the only kind of CRM surface that survives.

The sales pipeline is then one lens over the same board, filtered to people with
an open opportunity. That is why it is a special case.

### 3.2 "What requires attention" — five named conditions, not a score

**Do not build a closeness score.** A single number is lead scoring wearing
community clothes: wrong in ways nobody can argue with, and for a facilitation
business, quietly offensive — it turns people into a ranking. Refuse it the same
way the CRM analysis refuses enrichment.

Instead, a small set of conditions, each of which is a sentence you could say
out loud to the person's face:

1. **Went quiet.** In touch on some rhythm, and now past it. *Against their own
   baseline, not a global threshold* — someone you speak to yearly is not stale
   at ninety days. This is deal rotting generalised from opportunities to
   people, and `activity.occurred_at` already carries it.
2. **Arrived and unattended.** Came to something, and nobody has spoken to them
   since. The most common failure in a community, and completely invisible today.
3. **Finished with nothing next.** Completed a journey or a thread; no
   enrolment, no follow-up, no task.
4. **An ambassador drifting.** Flagged `is_ambassador` or `advocate`, and the
   cadence is dropping. Losing one of these is expensive and slow, so it is
   worth seeing early.
5. **Carrying too much.** Appearing in many active things at once. This one
   points at your own team as much as the community, and it is the burnout
   signal no CRM has because no CRM knows what delivery looks like.

Each is a filter with a plain-language reason attached and one obvious action.
No weights, no maths anyone has to trust.

### 3.3 "Relationships with others" — two views, not a hairball

The force-directed node cloud is the classic mistake here. It demos
beautifully and answers no question anyone has. Two narrow views earn their
place instead:

**Who brought whom.** An introduction tree from `relationship.type =
introduced_by | referred` plus `person_relationship_context.introduced_by`. In a
community, the people who bring others are worth more than the people who spend
most, and no CRM shows this. Fibre already stores the edges and displays exactly
one of them, on one profile tab.

**Who they know here.** On a person's profile, the handful of people they are
connected to — co-facilitated with, sat in the same small thread, share an
organisation. This is the question a facilitator actually asks before a
conversation, and it is answerable from `thread_enrolment` and `org_membership`
without anybody typing an edge.

**Typed edges and derived edges are different things and must stay different.**
A typed edge is a human assertion: "Marja introduced Daniel." A derived edge is
an inference: "these two were in the same room." Show them differently, and
**store only the typed ones**. An inference about a relationship between two
people is personal data about both of them, and writing guesses into a database
that has an Article 15 export is a promise you would rather not make. Derive at
read time, display as what it is, keep nothing.

### 3.4 "When does it need moving" — cadence, per person

Rotting again, and the same mechanism: `flow_run.current_step_entered_at` for
process position, `activity.occurred_at` for relationship cadence. The only new
idea is that the threshold is **per person and learned from their own history**,
not a number set in settings. A global "90 days" produces a list that is wrong
for everybody at once.

---

## 3.5 Where the characteristics come from

*(Added 2026-09-11. Sjoerd: "is this by predefined sets — pipeline, membership
type, roles in org, amount of Meets, amount of Threads — but can people also
make their own set, for example which SDG someone is interested in?")*

Two sources, and neither one is a settings screen somebody has to fill in.

### Predefined: emergent from the apps, like the profile tabs

Fibre already has a principle for exactly this. A person's profile shows an
identity tab plus one tab per app that holds data on them — the tabs appear
because the data does, resolved by `GET /persons/:id/apps`. **Characteristics
work the same way.** A workspace without Membership has no tier characteristic.
Turn Pulse on and pipeline stage appears. Nobody curates a list, and the list is
never wrong.

What that yields today, all from live tables:

| From | Characteristics |
|---|---|
| **Platform** | Organisation and role; city, region, country; languages; sector, industries worked in, expertise areas, certifications, seniority, career stage; how they arrived (`source`: event attendee / referral / cold outreach / client contact / inbound); who introduced them; closeness; key contact and ambassador flags |
| **Organisation** | Stated values, cultural descriptors, governance model, maturity stage — inherited by their people |
| **Thread** | Threads attended, thread categories, certificates held, participant vs organiser |
| **Meet** | Meetings had, meeting types, team membership |
| **Membership** | Tier; status (active / grace / lapsed / cancelled) |
| **Pulse** | Pipeline stage; offering bought; project |
| **Flow** | Which flow, which step |
| **Ledger** | What they bought, when, how much |

That is a large vocabulary and none of it needs inventing.

**Counts need bucketing, and the buckets should not be configured.** "Amount of
Meets" is a number, and numbers do not relate people until they are banded. Band
by quantiles *within the workspace* rather than fixed thresholds — the top
decile of meeting frequency means something in every workspace, "more than ten
meetings" means something in only some. Same philosophy as the rarity rule in
[`connections-desktop.md`](connections-desktop.md) §5b: adapt to
the data, do not ask anyone to tune it.

### User-defined: these are tags, and the table has been there since day one

Yes, people should be able to make their own. "Interested in SDG 13" is a real
characteristic and no predefined list will ever contain it.

**This is not a custom field, and the distinction is the whole answer.** A
custom field is a new attribute on a person — unbounded, unmaintained, schema
drift, and exactly what the app-justifies-the-field rule refuses. A custom set
is a *named group of people*, which is a tag. `public.tag` and
`public.person_tag` have existed since the first migration, with workspace
scoping and a colour, and — like `relationship` — they are read by nothing
except the Article 15 export. Another table that was modelled on day one and
has been waiting for a reason to exist.

So: **user-defined characteristics are tags.** No new schema, no custom fields,
no second taxonomy.

### Why this does not rot, which is the usual objection

Tag systems normally decay. Everyone invents their own, nothing is consistent,
and within a year nobody trusts them. The standard fix is governance, which
nobody does.

**The rarity rule polices it automatically.** A tag on three people is a strong
link. A tag on three hundred is not a link at all, so it quietly stops drawing
edges without anyone having to clean it up. A duplicate tag nobody uses has no
effect on anything. The system tolerates mess because weight is derived from
frequency rather than from anyone's discipline.

This is the argument that changed my mind. The CRM analysis and the desktop doc
both said fixed vocabularies only, on the grounds that per-workspace taxonomies
go unmaintained. That is still true of taxonomies that *drive behaviour*. It is
not true of a set whose influence is automatically proportional to how
discriminating it is.

---

## 3.6 Entries — who can get me in

*(Added 2026-09-11. Sjoerd: "a function in Connections that shows ENTRIES —
people who know organisations or people.")*

An **entry** is a path from you, or from anyone in your workspace, to a person or
an organisation you want to reach — with the reason attached. *"You want to reach
Acme. Marja worked there until 2023 and you co-facilitated Athens with her."*

This is the thing relationship-intelligence tools charge a great deal of money
for, and Fibre has unusually good material for it because it knows participation
and history, not just contact records.

### Three rules, or it produces noise

**Cap at two hops.** One hop is an entry: you know someone at Acme. Two hops is
a maybe: you know someone who knows someone. Three hops is not a relationship,
it is a coincidence with extra steps. Almost every graph feature that disappoints
does so by showing long paths because it can.

**Path strength is the weakest link, not the sum.** This is the trap worth naming
explicitly, because the obvious implementation adds or averages. If you are close
to Marja and Marja barely knows the Acme CEO, that path is weak — the chain is
only as good as its thinnest edge. Take the minimum. Summing makes long weak
chains outrank short strong ones, which is exactly backwards.

**Recency decays every edge.** A strong connection from eight years ago is not a
strong connection. The cadence data in §4 already carries this; apply it to edges
as well as to people.

### "Who do we know", not "who do I know"

A workspace is several people, and **the collective network is the asset.** The
useful question is rarely *do I know anyone at Acme*; it is *does anyone here*.
That is the version worth building.

One caution. There is a difference between *"Marja is connected to Acme"* — a
fact the team can see — and *"Marja's relationship with Acme is weak"* — which is
Marja's judgement about her own relationship. Show the connection; let the
colleague qualify it. Surfacing a teammate's assessment of their own contacts
without them saying so is how a shared network becomes a thing people stop
feeding.

### An entry lands on a person, and not all people are equal

`org_membership` is richer than I expected and it makes entries sharp rather
than vague. It carries `is_decision_maker`, `is_budget_holder`, `is_champion`,
`influence_level`, `seniority_level`, and `role_in_change` ∈ *sponsor, champion,
implementer, sceptic, bystander, gatekeeper*.

So an entry can say **who it actually reaches**: knowing the receptionist is not
knowing the budget holder. And the vocabulary cuts both ways — **an entry via
someone marked sceptic is a warning, not an opportunity**, and should be shown as
one.

**`ended_at` is the quiet gem.** Because memberships have an end date, Fibre
knows where people *used to* work. A former employee is one of the strongest warm
paths that exists and most CRMs cannot see it at all, because they only store
where someone works now.

### The ask is the product

Finding the path is half of it. A lookup that ends in a name goes nowhere. **One
tap turns an entry into a task for the connector** — "ask Marja for an
introduction to Acme" — which is the same rule as everything else here: every
next action is a `flow_task`.

### The reverse, which may matter more

The same query run backwards asks *whom could I give an entry to*. **"Daniel is
trying to reach Acme, and you know two people there."**

For a sales tool that is a footnote. For a community builder it is arguably the
main event: your value in a community is partly that you connect people who
should know each other, and nothing currently helps anyone do that deliberately.
It is also the generous direction, which suits the audience better than the
extractive one.

### Cold start, and the empty answer

`relationship` is empty and `introduced_by` is captured in one field on one
profile tab, so entries cannot launch on typed edges. **They launch on derived
ones** — shared organisation, shared thread, same session, co-facilitation, past
employment — which is enough to be useful on day one, and composes with the rule
that derived edges are displayed and never stored (D26).

**And the no-path answer has to degrade, not fail.** Most early lookups will find
nothing. *"No path"* is a dead end; *"no path, but three people you know are in
the same sector and two attended Athens"* keeps the user in the tool. Degrade to
relatedness rather than to an empty state.

Every entry states its reason in words, never a score — the same rule as derived
edges generally. *"Because they co-facilitated Athens in 2026"*, not
*"connection strength 0.7"*.

---

## 4. Closeness, stated honestly

Sjoerd's word is the right one, and it should stay a *description*, never a
metric. Five observable facts, each shown as itself:

| Fact | Source | Note |
|---|---|---|
| When we last actually spoke | `flow_note` (personal kind only) | A newsletter is not a conversation — decision D19 exists precisely for this |
| Their own rhythm, and whether it is changing | `activity` over time | The baseline for "went quiet" |
| Depth of involvement | the lifecycle ladder in §3.1 | attended → returned → contributed → facilitated → brought someone |
| Who initiates | `activity` direction, `flow_note.origin` | Reciprocity is the truest closeness signal and almost nobody records it |
| How many they have brought | `relationship` introduction edges | The community multiplier |

The depth ladder is the piece worth dwelling on. It is a real facilitation
progression — showing up, coming back, contributing, holding space, bringing
others — and every rung is already recorded somewhere in Fibre. Making it
visible is most of the product.

---

## 5. Two things to be careful about

**This can feel like surveillance, and the language decides.** A dashboard that
ranks a community by drift is a different object from one that helps a
facilitator notice someone. The rule: **show only what the facilitator could
have observed anyway** — that someone came twice and then stopped, that nobody
followed up after a workshop. Not inferences about intent, mood or worth. And
the words matter more than usual here: *"went quiet"* rather than *"at risk"*,
*"has brought others"* rather than *"influence score"*. For a business whose
product is trust, this is not cosmetic.

**The graph is personal data about third parties.** The `relationship` table
records facts about two people at once, and only one of them is looking. It is
already in the Article 15 export, which is right. Derived edges must not be
stored (§3.3), and the introduction tree should be visible to people with the
membership to see both ends, not everyone.

---

## 6. What this changes

Not much of the work, quite a lot of the framing and the order.

**The landscape becomes the primary surface.** It is a read over live tables, it
asks the user for nothing, and it is useful on day one. The pipeline board
becomes a filtered view of it. The Today surface becomes its daily slice.

**Almost nothing new is needed.** Ranked by cost:

| Item | Cost | Notes |
|---|---|---|
| The derived lifecycle | small | one query, no schema |
| The five attention conditions | small | filters over `activity`, `enrolment`, `thread_enrolment` |
| "Who they know here" | small | derived at read time, stored nowhere |
| Cadence baselines per person | medium | needs history, which exists |
| Writing `relationship` at last | small | a UI for a table that has been waiting since phase 0 |
| `flow_note` | already planned | supplies "when we last actually spoke" |

**Revised order**, folding in the integrity doc's step 0:

| Step | Item |
|---|---|
| 0 | `resolvePerson()` + merge tool — unchanged, still first |
| 1 | **The landscape board** — derived lifecycle, no new tables |
| 2 | **The five attention conditions** — with plain-language reasons |
| 3 | `flow_note` — conversations, which then feed closeness properly |
| 4 | Cadence and rotting, per person and per deal, one mechanism |
| 5 | The relationship graph — write `relationship`, show the introduction tree |
| 6 | Calendar scan and moments |
| 7 | Pipeline as a filtered landscape view; Pulse unchanged underneath |
| 8 | Today; then newsletter; then BCC |

Steps 1 and 2 now come before the note-taking, which is a reversal. The reason
is the adoption argument: a surface that shows you something on day one earns
the right to ask you for something on day three.

---

## 7. Decisions

**D23 — The landscape is the primary surface; the pipeline is a view of it.**
*Recommended: yes.* This is Sjoerd's reframe and I think it is correct. It also
matches the naming brief, where Sales is a function serving Thread rather than a
product of its own.

**D24 — Community standing is derived, never typed.** Computed from activity,
enrolment, membership and purchase. Nobody maintains it by hand.
*Recommended: yes* — a hand-maintained stage field on four hundred people is
wrong within a month.

**D25 — No closeness score.** Named conditions with plain-language reasons
instead of a number. *Recommended: yes,* and worth putting in the brief, because
a score will be proposed again and it will sound reasonable every time.

**D26 — Derived relationship edges are displayed, never stored.** Typed edges
are human assertions and get written to `relationship`; inferred ones are
computed at read time and kept nowhere. *Recommended: yes.*

**D27 — Which lifecycle rungs are real for this community?** *No recommendation
— this is Sjoerd's to define.* I proposed *touched → attended → returned →
contributor → facilitator → dormant*, but the rungs should come from how
facilitation actually progresses at soul.com and EBBF, not from my guess. Get
this wrong and every view above it is subtly off.

**D50 — Predefined characteristics are emergent from active apps,** the same way
profile tabs already are. No curated list, no settings screen. *Recommended:
yes.*

**D51 — User-defined characteristics are tags, not custom fields.** `tag` and
`person_tag` exist and are unused; a custom *set* of people is a different thing
from a custom *field* on a person, and only the second one is refused.
*Recommended: yes.*

**D52 — Numeric characteristics band by workspace quantile, not fixed
thresholds.** *Recommended: yes* — same reasoning as the rarity rule.

**D60 — Entries cap at two hops, and path strength is the weakest edge.**
*Recommended: yes,* and the weakest-edge rule needs writing into the ticket
because summing or averaging is the obvious implementation and ranks long weak
chains above short strong ones.

**D61 — Entries are workspace-wide, but a colleague's own assessment of a
contact is not exposed without them.** Show the connection, let them qualify it.
*Recommended: yes.*

**D62 — Entries name who they reach, using `org_membership`.** Decision maker,
budget holder, gatekeeper — and an entry through someone marked `sceptic` is
shown as a warning. *Recommended: yes;* this is what makes an entry actionable
rather than trivia.

**D63 — Build the giving direction alongside the getting one.** "You could
introduce Daniel to Acme." *Recommended: yes* — it is the same query reversed,
and it is the half that fits a community builder rather than a salesperson.
