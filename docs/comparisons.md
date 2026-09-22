# What we looked at, what we took, and why

Every time somebody asks "how does X compare to what we do", the answer gets
worked out once and then lost in a chat. This file is where it stops being
lost. Started 2026-09-15, on Sjoerd's instruction:

> *"Can you make a doc where we keep track of all comparisons we make. And
> which things we took as inspiration/stealed. And why to choose that app or
> why to choose our app. Could be uz, functionality or architecture."*

## How to use this file

**This is an index, not an argument.** Where a real decision was written up
somewhere else, the row points at it and says the conclusion in one line. It
does not restate the reasoning. This repo's whole history is hand-maintained
copies going quietly stale, and a second copy of a live argument is the same
bug in a new file.

So: **the pointer is the content.** If a row has no pointer, the reasoning
lives here because it lives nowhere else yet.

**Add a row when a comparison actually happens** — when somebody asks, when a
build-versus-buy is settled, when a screen is copied. Not speculatively.
Nothing leaves this file; a rejected thing that later gets adopted gets a new
line under the old one, dated.

**Four dimensions**, per Sjoerd: **UX**, **functionality**, **architecture**,
and **commercial** (price, terms, who holds the data). Most entries touch more
than one; the table names the one that decided it.

---

## The table

| What | Dimension | Verdict | In one line | Where the argument lives |
|---|---|---|---|---|
| **Memberful** | Commercial | Rejected, blueprint kept | 4.9% of every transaction forever, and member data at a US company beside an EU data wall | [`membership-proposal.md`](membership-proposal.md) §2 |
| **Circle.so** | Functionality | Integrate, never compete | soul.com already runs its community there; access sync is API glue whoever builds it | [`membership-proposal.md`](membership-proposal.md), [`spike-circle-sso.md`](spike-circle-sso.md) |
| **Calendly** | UX + functionality | Shape copied | Meet is "Calendly-shaped", re-anchored on the contact graph | [`meet-architecture.md`](meet-architecture.md) |
| **Zoom** | Functionality | Integrate | Meet books the meeting; Zoom hosts it | `apps/meet/app/docs/zoom/` |
| **Stripe** | Architecture | Adopted as rails only | Stripe is rails, the purchase ledger is the record | `lib/payment-accounts.ts`, CLAUDE.md |
| **Pipedrive, Close, Nutshell** | Functionality | Not our shape | Pipeline-first: a deal moving through stages. Fibre has no close moment | [`connections-market.md`](connections-market.md) §2 |
| **folk, Capsule, Nimble, Less Annoying** | Functionality | Adjacent | Contact-first. Closest archetype, but priced per seat for a sales team | [`connections-market.md`](connections-market.md) §2 |
| **Salesflare, Attio** | Architecture | Deliberately opposite | Auto-filling: mailbox and calendar sync build the record for you. We refuse the inference | [`connections-market.md`](connections-market.md) §2, [`connections-data-integrity.md`](connections-data-integrity.md) |
| **Virtuous, DonorDock, CiviCRM, Bloomerang** | Functionality | Our archetype | Stewardship: cadence over years, retention and lifetime value, no close | [`connections-market.md`](connections-market.md) §2 |
| **Notion, Airtable** | Architecture | Rejected as a pattern | The empty custom-field box. "No custom fields is a feature, not a limitation" | [`connections-market.md`](connections-market.md) §4 |
| **Dex** | Functionality | A fifth archetype, and it wins its own game | Personal CRM: one person's own network, no organisation anywhere in it | this file, below |
| **Visual Thesaurus** | UX | Taken outright | The moving web: click a name, it centres, the cloud rebuilds, lines run via junctions | [`connections-desktop.md`](connections-desktop.md), v0.73.24–33 |
| **macOS Finder** | UX | Taken outright | The landscape browsed as columns | v0.75.x, `connections-asks.md` ask 20 |
| **Element / Matrix** | Architecture | Open exploration | Sovereign messaging; the limit is federation against erasure | [`inbox.md`](inbox.md), 2026-09-15 |
| **Roseman Labs** | Architecture | Parked; partner, not build | Multi-party computation: several organisations compute a joint answer without pooling records. A different unit, and the only shape that pays for it is cross-workspace | this file, below |
| **HubSpot, Mailchimp** | Architecture | Not competitors, worked examples | Used in the docs to show how a third-party app's entities map across the wall | [`fibre-vs-app-data.md`](fibre-vs-app-data.md) |
| **Thread** (internal) | UX | Design-leading | When two apps disagree on a shared surface, Thread is right | CLAUDE.md, Components first |

---

## Entries whose reasoning lives here

### Dex — 2026-09-15

**What it is.** A personal CRM. One user, one price, around $12 a month billed
annually. Unlimited contacts, keep-in-touch reminders on a Kanban board,
LinkedIn sync flagging job changes, WhatsApp and iMessage and Gmail and
calendar sync, AI follow-up suggestions.

**Why it is worth a row: it fits none of the four archetypes.**
`connections-market.md` §2 sorts the market into pipeline-first,
contact-first, auto-filling and stewardship. Dex's unit of account is one
individual's own network with no organisation in it at all. That is a fifth
shape, not a smaller folk, and §2 should probably gain a row.

**Why them.** For one person trying to stop forgetting to follow up, Dex wins
today, and it is not close. Shipped, polished, cheap. If that is the actual
need, buying beats building.

**Why us.** Three things, and only the first is about maturity.

- **The unit.** Dex is one person. Connections is a workspace with RLS, app
  membership and a shared relational field. A team cannot use Dex together.
- **Where the knowledge comes from.** Dex ingests your messages to infer
  relationship state. Connections refuses by construction: `detect-tags.ts`
  declines to send note bodies to a model at all, and the handbook rule says
  co-occurrence is not a relationship. Dex knows more about you because it
  holds more of you. That is the trade, stated plainly.
- **Delivery.** Market doc §4 already makes the point about Pipedrive: it
  knows you won, and not that the workshop happened, who came, whether they
  paid, whether they came back. Dex knows less still, because it hangs off an
  inbox rather than off delivery.

**What to steal.** LinkedIn job-change detection. Somebody changing employer
is a dated, stated fact about a person, not an inference from co-occurrence,
so it passes the exactness rule that keeps most enrichment out of this system.

---

### Roseman Labs — 2026-09-17

*Read from search results and their docs, not their own site: the network
policy in the build environment blocks `rosemanlabs.com`. Anyone with a
browser should check the claims below against the source.*

**What it is.** A Dutch deep-tech company, founded 2020 by Toon Segers,
Roderick Rodenburg and Niek Bouman. Secure multi-party computation: several
organisations each encrypt their own data at source, link it, and run analyses
on the combined set while no party sees an individual record. The developer
surface is `crandas`, a Python package with pandas-like syntax that pushes the
computation to MPC nodes. Named customers include the NCSC, UMC Utrecht, the
Dutch government, over 100 childcare organisations, and insurers.

**The shared refusal.** Both they and this platform say you can get value from
data without one party holding it in the clear. That is real common ground,
and it is where most conversations about them stop.

**The different unit, which is the whole thing.** The Fibre's data wall runs
INSIDE one workspace: RLS scopes rows, apps cross only through `activity`, and
the boundary is a tenant. MPC solves a problem we do not have today — several
organisations who each hold data and want a joint answer without pooling it.
Between organisations, not within one.

**The one shape where it would earn its cost.** A cross-workspace question:
how many people across a whole network completed something, or a benchmark
between social enterprises, where the workspaces will not hand each other
person rows. That shape is coming. It is also the only one worth the price,
because MPC is expensive three ways — compute, engineering, and an operating
model needing multiple non-colluding nodes run by genuinely separate parties.
That is a partnership or nothing. Never a bolt-on.

**The tension to keep in view.** MPC protects data DURING COMPUTATION. It says
nothing about erasure, purpose limitation, or brief §5's rule that the app
justifies the field. There is a live risk that the cryptography reads as a
licence to collect more, because it "makes it safe". Our discipline is
minimisation by construction; theirs is computation on data that could not
otherwise be pooled. Those point in opposite directions, and adopting the
second without noticing would quietly undo the first.

**What to steal regardless.** The `crandas` design choice: keep the familiar
API, change the backend underneath. Make the safe path the one people already
know how to type — the same move as the shared `apiFetch` and the components
rule. Their disclosure-risk vocabulary is also sharper than most, and would
improve how the brief talks about what a report may reveal.

**Why them, why us.** Not a competitor. A credible partner and reference
point, and the obvious place to look first if a cross-workspace question ever
becomes a product rather than a hypothetical.

---

## A note on "stealing"

Two of the entries above were taken almost whole — Visual Thesaurus and the
Finder columns — and both were better for it. The pattern worth noticing is
that the things safe to copy are **interaction shapes**, where somebody else
has already paid for the learning and the result is visible in one look.

The things that keep getting rejected are **data postures**: the custom-field
box, the mailbox scrape, the enrichment vendor. Those are not shapes, they are
positions about what a system may know and hold, and a position cannot be
borrowed without borrowing its consequences.

Copying a screen is cheap. Copying a posture is not.
