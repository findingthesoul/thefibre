# Naming Brief: Thread, Fibre and the App Family

_Received from Sjoerd 2026-09-01, verbatim below. **Status: decided, version 1.**
Implementation started same evening (v0.23.0): display names + public copy per
Brief A/B; slugs, ids and URLs untouched (they are FKs and published contract —
the plan-ids precedent). The Meet-standalone question and the domain strategy
are parked for the 2026-09-02 session alongside docs/environments.md._

---

Status: decided, version 1
Purpose: single reference for engineering renames and for website positioning. Revisit only if scope of Thread changes (see open question at the end).

## 1. The structure, in one paragraph

Fibre is the invisible foundation. Thread is the flagship, the product people meet and feel. Meet, Sales and Flow are functional tools that serve Thread, not siblings competing with it. Nothing in the public facing layer needs textile language beyond Thread itself, unless stated otherwise below.

## 2. The layers

### Fibre
What it is: the platform, identity and data layer. Multi tenant CRM and identity foundation underneath everything.
Audience: backstage. Occasionally named to technical partners, cooperatives or enterprise clients if data sovereignty or architecture becomes part of the pitch. Never the first thing a customer meets.
Naming: keep as is. Fibre, The Fibre, thefibre.app.

### Thread
What it is: the flagship product. Currently defined as the learning journey a person walks. This is the core of the business and the main public brand.
Audience: public, customer facing, primary.
Naming: Thread. Drop "FiberSales" or "the Thread" style hybrid references, Thread stands alone as the master brand.
Open question, parked deliberately: Thread may later expand from journey to platform, with the journey becoming one part of a larger Thread. Do not build for this yet. Note it so nobody relitigates the decision from scratch.

### FiberFlow, internally Flow
What it is: the engine. Pipeline and task gate mechanism, state machines with task gates, the substrate other tools are built on. Not a product a customer opens.
Audience: internal, operator and builder facing only.
Naming: Flow, plain function name. Loom was tested and rejected as customer facing language, since nobody says "let me check the loom." Keep Loom only as internal shorthand in documentation if useful, never in product UI or marketing.

### Meet
What it is: facilitated meeting scheduling. Currently a distinct app, but functionally closer to an event type living inside a Thread than a separate product. Worth revisiting whether Meet needs to be a standalone app at all, or becomes a feature of Thread.
Audience: operator and end user, functional.
Naming: Meet, plain function name.

### Sales
What it is: CRM tool for moving a prospect toward becoming a Thread. Built on Fibre and Flow together. Operator facing, not something a customer directly experiences.
Audience: internal, sales team.
Naming: Sales, plain function name. Textile alternatives considered and set aside: Warp, the pipeline held under tension before weaving. Shuttle, the repeated back and forth motion of selling. Spindle, converting raw fibre into thread. None adopted, since the team test failed: nobody says "check their Warp" out loud. Keep this list in case the aesthetic scope changes later.

### Tapestry and Stitch, or Knot
Status: optional, not yet activated.
Tapestry: the whole suite seen together, many threads interlaced. Only relevant if a workspace or aggregate view becomes public facing.
Stitch or Knot: a single moment of contact, smaller than a Thread. Only relevant if a customer ever sees this word directly, for example "a stitch was added to your thread." If this stays purely internal, use plain words instead, event or touchpoint.
Decision needed later: pick Stitch or Knot, do not keep both live.

## 3. The test that decided this

A word only earns textile language if a customer would plausibly say it out loud to another human. "I got a message on my Thread" passes. "My rep moved me through their Warp" does not. Apply this test to any future naming decision in this system before adopting a new word.

## 4. Brief A: for code, moving and naming things correctly

Use this as the reference when renaming folders, slugs, database entities, environment variables and internal documentation.

Rename or confirm:
Thread stays the master brand and public slug. If FiberFlow or the Thread currently appears as a hybrid label anywhere in code, comments or docs, replace with Thread alone.
FiberFlow becomes internal Flow. Keep the technical slug flow as already established. Remove any customer facing surface that currently exposes the name FiberFlow or Loom, this stays backstage.
Fibre Meet, Fibre Sales, Fibre Learn: drop the Fibre prefix in anything customer facing. Internally the prefix can remain in repo names or infra labels if that helps discoverability, but UI copy, marketing copy and support documentation should read Meet, Sales, Learn, or their eventual functional names, not Fibre Meet.
Sales: no rename needed yet, functional name confirmed. If Warp, Shuttle or Spindle appear anywhere in exploratory docs, mark them as rejected options, not live names.
Meet: flag for a product decision, not just a naming one. Confirm with Sjoerd whether Meet remains a standalone app or becomes an event type inside Thread before doing a deeper rename or restructure.
Do not implement Tapestry or Stitch or Knot anywhere yet. These are reserved names, not active features.

The data wall principle is unaffected by this brief: what happens inside an app stays inside that app, only event type and subject cross to the platform layer. Naming changes should not be read as license to change that boundary.

## 5. Brief B: for website copy and positioning

Use this to check and refine any public facing text, whether on thefibre.app, a Thread landing page, or app specific pages.

Thread is the name people meet first and say out loud. It should read as the flagship, not as one app among several. Copy should describe Thread as the ongoing learning journey a person walks, not as a piece of software or a dashboard.

Fibre should almost never appear on customer facing pages. Where it does appear, for example a technical partner page or an "under the hood" note, keep the story simple and strong rather than detailed. Fibre is the shared foundation that makes The Thread possible, not something a learner needs to understand to use it.

Meet, Sales and Flow should not be marketed as separate products with their own identity or story. Where they appear in copy at all, describe them by function, in service of Thread, not as siblings with equal billing. For example, describe Meet as how meetings happen inside a Thread, not as a separate offering.

Positioning tone, carried over from existing guidance: collaborative and curious, accompaniers who walk alongside, not authoritative, journalistic or expert. Applies fully to how Thread is described. Thread should read as something people walk together, not something they are sold or onboarded into.

Do not introduce Tapestry, Stitch or Knot into any live copy yet. If a page currently uses these words, either remove them or flag for review, since none are confirmed as public vocabulary.

Open question to hold in reserve, not for current copy: whether Thread eventually becomes a platform with the journey as one part of it. Until that is conceptualized, all copy should describe Thread as the journey itself, not as a container for future things.
