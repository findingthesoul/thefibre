# Sales, reconsidered

*Written 2026-09-11, from Sjoerd: "maybe Sales can become Possibilities or
Opportunity." Addendum to [`naming-brief.md`](naming-brief.md) §Sales, which
confirmed "Sales" as a plain function name on 2026-09-01. Companion to
[`connections-overview.md`](connections-overview.md).*

---

## 1. The reframe reopened this, not fashion

The naming brief settled Sales by rejecting textile alternatives — Warp,
Shuttle, Spindle — on a good test: *nobody says "check their Warp" out loud.*
That test still stands and both of Sjoerd's candidates pass it. But the reason
to reopen the question is not aesthetic. **The thing being named changed.**

Everything since [`connections-model.md`](connections-model.md) says the
product is a landscape of relations, that stewardship rather than velocity is
the shape, and that the pipeline is one axis of five. Calling that Sales names
one fifth of it.

**And there is a concrete argument sitting in the code.** `fibre-sales` is not a
hypothetical unbuilt app — it is a live app id that owns curator data today:

```
person_relationship_context  → fibre-sales   (persons.ts:448)
org_relationship             → fibre-sales   (organisations.ts:343)
person_billing / org_billing → fibre-sales
```

So the app called Sales already owns **the relationship record itself** — source,
who introduced them, relationship strength, relationship stage, health status,
touchpoint counts. The fields the whole landscape is built on are, right now,
tagged as Sales data.

That is the argument. The app that answers *"how is this relationship going"*
should not be called Sales.

---

## 2. What a rename costs: one label

Nothing structural. The slug rule already exists in this codebase and has a
precedent: Membership's display name may become "Hyve" while the slug
`membership` never changes. Same here — `fibre-sales` stays in the database
forever, and `label: 'Sales'` in `apps/web/lib/apps.ts` is the change.

This is the cheapest naming decision available. It is also the last cheap
moment: once a surface is built and people learn where things live, renaming
costs re-teaching rather than an edit.

---

## 3. The two candidates

**Opportunity** — I would not. It is Salesforce's object name, and adopting it
imports precisely the frame being rejected: a potential deal with a value and a
close date. It sounds neutral and is not. It also has a plural problem — the
nav wants "Opportunities", the record wants "an Opportunity", and the brief's
out-loud test passes only because salespeople already say it.

**Possibilities** — better, and better for a reason worth stating: it covers
more than deals. A possibility can be a collaboration, an introduction, someone
ready to facilitate. That genuinely matches the reframe in a way "Opportunity"
does not. Against it: five syllables, weak in the singular, and vague as a
navigation label — *"where do I log a call?"* is not obviously answered by
"Possibilities".

Between the two: **Possibilities.**

---

## 4. But the rename may be solving the smaller problem

Both candidates still name the commercial axis, just more gently. If the
pipeline is one axis of five, then the thing that actually needs a name is the
**landscape**, and neither word describes it.

**The naming brief already anticipated this and parked a name.** From §"Tapestry
and Stitch, or Knot":

> *Tapestry: the whole suite seen together, many threads interlaced. Only
> relevant if a workspace or aggregate view becomes public facing.*

An aggregate view of the whole workspace is exactly what the landscape is. The
condition the brief set has now been met.

The same section parked a second name that this exploration has made relevant:

> *Stitch or Knot: a single moment of contact, smaller than a Thread… Decision
> needed later: pick Stitch or Knot, do not keep both live.*

That is the conversation note — `flow_note` in
[`connections-what-exists.md`](connections-what-exists.md) §3.1. A single
moment of contact, smaller than a Thread, is the definition.

So the brief has two names waiting for conditions that have arrived, and one
name (Sales) whose subject has changed underneath it.

---

## 5. What I would actually do

**The axis does not need a product name.** In the picker described in
[`connections-mobile.md`](connections-mobile.md) §2, the five
axes read *maturity, closeness, cadence, opportunity, contribution*. "Opportunity"
as a lowercase filter label is clear, understood and carries no branding weight
at all. That is the right home for the word — a label, not a product.

**Then the naming question becomes the right one:** what is the landscape
called. Tapestry is parked and fits; whether it survives the out-loud test is
Sjoerd's call, and the brief's own standard is the one to apply.

**And the display label "Sales" should change regardless**, because it currently
titles the profile tab holding the relationship record. Even if nothing else is
decided, that tab is misnamed today.

---

## 5.5 One metaphor, and Thread already has it

*(Added 2026-09-11. Sjoerd: "it is also a map, a lay of the land, a landscape, a
lens — all are just another analogical layer, fighting with Thread. So it should
say what it is. Maybe Connections.")*

This is right, and it defeats the suggestion I made one section earlier.

**The brief's established pattern is exactly this:** Thread carries the
metaphor, and every function beside it is a plain word — Meet, Flow. Warp,
Shuttle and Spindle were rejected not only because nobody says them out loud but
because they were a second textile layer competing with the first. **Tapestry is
the same mistake**, and I surfaced it because it was parked in the brief without
noticing it violates the brief's own rule. Withdraw it.

**And "landscape" is a metaphor too.** I have been building one all session —
these documents were literally named `community-landscape*.md` until this decision
landed, and map, lay of
the land, lens and cloud are all the same analogical layer. It was useful for
thinking and it is wrong for the product surface. Worth saying plainly, since I
introduced most of it.

So: a plain word that says what it is.

### Connections — one concrete problem

It passes the out-loud test cleanly, matches the Meet/Flow register, and covers
both halves of the thing: your connection to a person, and people's connections
to each other.

The problem is inside this codebase rather than outside it. **`connection`
already means OAuth account links here** — `public.user_connection` holds Google
refresh tokens and personal room URLs, and `apps/api/src/lib/connections.ts` is
its single sanctioned accessor. An engineer reading "Connections" in this repo
will think integrations before they think people.

That is not fatal — a display label and a table name live in different worlds,
and Membership already proves a label can diverge from its slug. But it will
cause a beat of confusion in every technical conversation, forever, and it is
worth knowing before choosing rather than after.

The secondary issue is that LinkedIn owns the word for a personal network.
Arguably a help — people know instantly what it means — but it is borrowed
rather than owned.

### Relations, the alternative

By Sjoerd's own criterion — *say what it is* — this is the most literal
candidate available, because it is what the tables are actually called:
`relationship`, `org_relationship`, `person_relationship_context`. It names both
halves too: the state of closeness, and the links between people. Nothing else
in the repo or the market has claimed it.

Against it: "Relations" alone reads slightly off in English as a label, drifting
toward public or international relations. "Relationships" is unambiguous and
five syllables.

### Where I come out

**Connections**, with the collision known and accepted. It is the better word to
say and to read, the internal ambiguity is confined to engineers who will learn
it in a day, and Sjoerd reached for it unprompted — which in this brief's own
methodology is the strongest evidence there is.

If the collision does bother the next person to look at it, **Relationships** is
the fallback and loses very little.

One consequence either way: these documents should eventually be renamed to
match, since `connections-model.md` would then describe a surface that is not
called that.

---

## 6. Decisions

**D53 — "Sales" as a display label goes.** It names one axis of five and
currently titles the tab that holds the relationship record. *Recommended: yes.*
The slug `fibre-sales` never changes; this is `apps.ts` and branding only.

**D54 — Between Sjoerd's two, Possibilities over Opportunity.** *Recommended,*
because Opportunity is Salesforce's object name and imports the deal frame; and
because a possibility can be a collaboration or an introduction, which matches
what is actually being built.

**D55 — Prefer "opportunity" as a lowercase axis label over any product name
for the commercial lens.** *Recommended: yes* — it follows the naming brief's
own rule that Meet, Sales and Flow are functions in service of Thread and should
not be marketed as siblings.

**D56 — WITHDRAWN (§5.5): not Tapestry.** A second textile word competes with
Thread, which is the exact reason Warp, Shuttle and Spindle were rejected. I
surfaced it from the brief without noticing it broke the brief's own rule.

**D58 — The surface gets a plain name, not a metaphor.** Thread carries the
metaphor; everything beside it says what it is. *Recommended: yes* — this is the
brief's existing pattern, stated.

**D59 — RESOLVED (Sjoerd, 2026-09-11): Connections.** The `user_connection` /
`lib/connections.ts` collision is known and accepted — an engineer will learn the
difference in a day, and a display label diverging from a slug is already
established practice here (Membership / Hyve). Relationships was the fallback and
is not needed.

**Consequences, done:** the exploration documents are renamed `connections-*.md`
and their cross-links rewritten. **Consequences, outstanding:** `label: 'Sales'`
in `apps/web/lib/apps.ts` becomes `'Connections'` (D53); the slug `fibre-sales`
never changes; and the prose in these documents still uses landscape, map, cloud
and lens as *thinking* language. That was useful for working the problem out and
should not reach product copy — see §5.5.

**D57 — Stitch or Knot for a conversation note?** The brief says pick one and do
not keep both. *No recommendation,* but the decision is now live rather than
hypothetical, because `flow_note` is step 3 of the build.
