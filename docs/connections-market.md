# What other CRMs do, and what people actually need

*Written 2026-09-10. Companion to [`connections-what-exists.md`](connections-what-exists.md),
which maps Sjoerd's seven verbs onto what Fibre already has. This one looks
outward: what the category has converged on, what the failure data says, and
which of it applies to the people Fibre serves.*

> **Amended 2026-09-11** by [`connections-calendar.md`](connections-calendar.md):
> the calendar turns out to be a capture channel Fibre has already paid for, so
> auto-capture from meetings lands ahead of the BCC address in §6, and the
> build order in §7 gains three calendar steps.

> **Fourth companion, 2026-09-11:**
> [`connections-data-integrity.md`](connections-data-integrity.md) answers how a
> quick-capture surface stays safe — and adds a **step 0** to the build order:
> nine call sites across six files create `person` rows independently, with no
> unique constraint and no shared resolver. Its §6 carries the current build
> order; decisions **D12–D16**.

> **Reframed 2026-09-11 — read this first:**
> [`connections-model.md`](connections-model.md). Sjoerd: for facilitators the
> core need is a *landscape* — where is everybody, what needs attention, who
> knows whom, what needs moving — and closeness to the community rather than
> sales. **The pipeline is a view of that, not the other way round.** That doc
> carries the current build order and decisions **D23–D27**.

---

## 1. The number that should shape the design

Between 30% and 70% of CRM projects fail to meet their objectives depending on
whose survey you read — Gartner near 50%, Forrester at 47%, one 2026 roundup
at 55%. That range has been stable for two decades, which tells you the cause
is not technical.

The breakdown is the useful part: **over 60% of failures trace to user
adoption**, and only 6–10% to the platform itself. The dominant complaint from
the person expected to type into it is that the CRM is a data-capture system
serving someone else's dashboard, and returns nothing to the person paying the
cost of entry.

That reframes the whole build. The risk to Simple Sales is not that it lacks
features. It is that Sjoerd stops logging things in week three. **Every design
decision below is judged on whether it lowers the cost of capture or raises
the return on it.** Nothing else has a track record.

---

## 2. Four archetypes, and which one Fibre is

The market has sorted itself into four shapes. They are not price tiers, they
are different theories of what a CRM is for.

| Archetype | Thesis | Examples | Core mechanic |
|---|---|---|---|
| **Pipeline-first** | A deal is an object that moves through stages; the job is velocity | Pipedrive, Close, Nutshell | Kanban board, next-activity prompt, rotting alerts |
| **Contact-first** | The relationship is the object; deals are episodes in it | folk, Capsule, Nimble, Less Annoying | Contact record with a full interaction history |
| **Auto-filling** | Manual entry is the disease; the CRM should build itself | Salesflare, Attio | Mailbox and calendar sync populate records without asking |
| **Stewardship** | There is no close moment; the job is cadence over years | Virtuous, DonorDock, CiviCRM, Bloomerang | Retention, lifetime value, last-touch, at-risk flags |

Pricing across the small end clusters tightly: folk €20–40, Capsule €21–75,
Pipedrive €24–129, Less Annoying €15, all per user per month.

**Fibre is the fourth, with a bit of the first bolted on.** The people who use
The Thread are facilitators, coaches, membership organisations and community
bodies like EBBF. The nonprofit-CRM literature describes their situation
exactly: relationships stewarded for years with no single close, where a donor
giving €50 a year for ten years matters more than a one-off €1,000, and the
metrics are retention, recurring revenue, lifetime value and stewardship
cadence rather than deal velocity. One consultant-CRM review puts the same
point bluntly about coaches: a sales CRM frustrates them because they do not
have a pipeline, they have clients who pay up front and stay ninety days.

This is not a small observation. It means the growth verb — last in the build
order in the exploration doc — is arguably the differentiator, and the pipeline
board is the commodity part. **Recommendation: move growth earlier.** See §7.

---

## 3. Table stakes, and what Fibre already has

Every features list in the category converges on roughly the same two dozen
items. Here they are against what is actually in the repo today.

| Feature | Why people want it | Fibre today |
|---|---|---|
| Contact management | The base object | **Have.** `person`, `organisation`, `org_membership`, plus a fuller relationship record than most CRMs ship — see §4 |
| Pipeline / deal management | See what is in play | **Have.** Pipeline flow + `pulse_commitment`, kanban in Flow |
| Follow-up reminders | The single most-used feature in every small CRM | **Have the substrate** (`flow_task` with `due_at`), no reminder surface |
| Interaction history | What did we last say | **Missing.** The one real gap |
| Two-way email sync | Capture without typing | **Missing.** The hard one — §6 |
| Calendar integration | Meetings are the conversations | **Have.** Google OAuth with calendar scopes, `user_connection` |
| Mobile access | Log it in the car park, not on Friday | **Have.** Bottom nav in six apps since v0.45.0 |
| Dashboard / today view | Where you start the morning | **Missing.** §5 of the exploration doc |
| Reporting | Where is the money coming from | **Have, and stronger than peers.** Pulse projections, `/admin/economics`, the purchase ledger |
| Quotes / proposals | Send the thing | **Partial.** `quote_url` is a link; nothing is generated |
| Invoicing and payments | Get paid | **Have, and far stronger than peers.** Stripe, ledger, invoices in three apps. Most CRMs at this price hand you off to Xero |
| Segmentation / lists | Who do I write to | **Partial.** Tags exist; no saved segments |
| Workflow automation | Stop doing the boring bit | **Have the engine.** Flow is a real state machine with gates — more capable than any small CRM's rule builder |
| Lead capture forms | Inbound arrives on its own | **Have adjacent.** Thread's enrol forms and embeds do this for events, not for enquiries |
| Custom fields | Every business is different | **Deliberately not.** The app-justifies-the-field rule forbids it — §4 |
| Email sequences, marketing automation, lead scoring, click-to-call, route planning | Outbound sales machinery | **Not present, and should stay that way** — §5 |

The striking thing about that column: Fibre is already ahead of the category on
money, automation and mobile, and behind on exactly one axis — knowing what
was said and when. Which is the axis the whole category is actually about.

---

## 4. Where Fibre is genuinely unusual

Three things Fibre has that the market mostly does not, worth protecting.

**The relationship record is better than the category's.**
`person_relationship_context` already holds `source` (event attendee /
referral / cold outreach / client contact / inbound), `introduced_by` pointing
at another person, `relationship_strength` (weak / warm / strong / advocate),
`communication_preference`, `best_time_to_reach`, `is_key_contact`,
`is_ambassador`, `first_contact_notes` and `first_contact_at` — with a live
API. Most small CRMs make you build the equivalent as custom fields. *(The
exploration doc §2 said there was no source field. That was wrong; corrected
there.)*

**No custom fields is a feature, not a limitation.** The category's standard
answer to "we're different" is an empty custom-field box, and the standard
outcome is a schema nobody maintains — the Notion and Airtable reviews say the
same thing, that a heavily customised setup becomes as hard to maintain as the
CRM it replaced. Fibre's rule that a field exists because a named app needs it
is the opposite bet, and it is the reason a Fibre profile stays readable. Hold
the line.

**Delivery is in the same system as the sale.** Pipedrive knows you won. It
does not know the workshop happened, who came, whether they paid, or whether
they came back. Fibre does — that is what the activity log and the purchase
ledger are. No CRM at this price can answer "which of last year's participants
have gone quiet", and Fibre can, from tables that already exist.

---

## 5. The three mechanics that decide whether it gets used

From the adoption research, three specific mechanics do most of the work.
All three are cheap here.

**Never leave a contact without a next action.** This is Pipedrive's entire
thesis, marketed as activity-based selling: the interface is built so that
completing an activity prompts you to schedule the next one. It is a UI rule,
not a feature — you cannot close the note composer without either setting a
follow-up date or explicitly saying "nothing planned". It costs nothing and it
is the difference between a CRM and a graveyard. This validates decision D3 in
the exploration doc, and should be added as a fourth: **D7**.

**Rotting.** Pipedrive flags a deal that has sat idle past a configurable
per-stage threshold, colour-coded on the board. Users describe it as a
behaviour driver rather than a report. Fibre can ship this with **zero
schema**: `flow_run.current_step_entered_at` already exists and is already
maintained. Add a per-step `rot_after_days` on `flow_step` and it is a
computed colour. This is the highest value-per-hour item in the whole
exploration.

**Capture where you are, when it happened.** The complaint that kills adoption
is Friday-afternoon backfilling. Two things fix it: a mobile surface, which
Fibre has in every app since v0.45.0, and a note that records when the
conversation happened separately from when you typed it — which is why
`happened_at` is in the proposed note table rather than relying on
`created_at`.

---

## 6. The email question — the one decision that is genuinely expensive

Two-way email sync appears on every must-have list. Capsule is criticised for
lacking it. Salesflare's entire pitch is that manual entry is the disease and
mailbox sync is the cure. Attio populates the CRM from communication history
the moment you connect Google or Microsoft.

The exploration doc waved this away as "the honest cost of simplest we can
imagine". The adoption data says that was too casual. But the full version is
disproportionately expensive **for Fibre specifically**, for a reason unrelated
to engineering effort.

Fibre's Google connection currently requests calendar scopes only
(`calendar.readonly`, `calendar.events`, `userinfo.email` in
`apps/api/src/lib/google/client.ts`). Reading mail needs Gmail scopes, which
Google classes as restricted: they require a verification review plus an
annual third-party security assessment, and they put a mail-reading permission
in front of every user of a platform whose whole promise is data minimisation.
*(The exact current cost and turnaround of that assessment should be checked
before anyone commits to it — my figure is out of date.)* For a platform that
tells people it holds type and subject but never bodies, asking for the
contents of their mailbox is also a hard thing to say out loud.

**There is a cheap middle, and it is what the practical CRMs actually ship.**
A per-user BCC address — Pipedrive, Capsule and Streak all have one. You BCC
it, the message becomes a logged touch against the matching person, subject
line only or with a body if the user wants. It needs no Google scopes, no
verification, no OAuth re-consent, and it works from any mail client on any
device including a phone. It captures the outbound half of the conversation,
which is the half you would otherwise never log.

Cost: an inbound mail route. Fibre runs Resend for outbound and has no inbound
handling today, so this is a new integration, but a small and well-trodden one.

**Recommendation: BCC-to-log, not mailbox sync.** New decision **D8**.

---

## 7. What this changes in the exploration

Four amendments.

1. **Correction.** §2 said there is no source field for initial contact. There
   is — `person_relationship_context`, with a live API. Initial contact is
   more built than the doc claimed; what is missing is that nothing surfaces it
   during a sale.
2. **Rotting joins the build order**, high, because it costs almost nothing and
   is the mechanic users credit with changing behaviour.
3. **Growth moves earlier.** Fibre's users are stewardship-shaped, not
   velocity-shaped. Lifetime value and gone-quiet are the reasons to use Fibre
   rather than Pipedrive, and burying them at step 6 buries the differentiator.
4. **Email gets a real answer** rather than a shrug: BCC-to-log.

Revised order:

1. `flow_note` — the conversation log, with `happened_at` and a mandatory next
   action *(D7)*
2. Rotting — `rot_after_days` on the step, colour on the board *(zero schema
   otherwise)*
3. Contact context in the pipeline — recent touches, open tasks, past
   purchases, relationship record
4. Growth view — lifetime value from the ledger, gone-quiet from touch
   cadence, `org_relationship` finally written
5. Today, in Flow — tasks and money dates, meetings if the agenda crossing
   lands *(D4)*
6. BCC-to-log *(D8)*
7. Offerings know their delivery — handover task on won *(D5)*

Steps 1–4 are a CRM that a facilitator would keep using. Step 4 is the one
Pipedrive cannot do.

---

## 8. Deliberately not building

The category will keep offering these. Each is a place where a simple product
becomes a mediocre big one.

- **Email sequences and marketing automation.** Different job, different
  consent posture, and it is where CRMs turn into spam tools.
- **Lead scoring.** Meaningless below a few hundred leads a month.
- **Custom fields.** §4. This is a principle, not a backlog item.
- **Click-to-call, route planning, territory management.** Field-sales
  machinery for a business that does not do field sales.
- **AI enrichment and auto-research.** The 2026 marketing baseline, and firmly
  at odds with a platform selling data minimisation. Scraping a stranger's
  LinkedIn into your database is exactly what Fibre's brief exists to refuse.
- **A second to-do list.** Every next action is a `flow_task` *(D3)*.

---

## 9. Two new decisions

**D7 — The next-action rule. REVISED by D30** — see
[`connections-data-integrity.md`](connections-data-integrity.md) §7.3. The
instinct holds; the blocking dialog does not. Original wording: closing a
conversation note requires either a follow-up date or an explicit "nothing
planned". It is the single mechanic most credited with CRM adoption — but
implemented as a modal it is exactly the threshold that stops people capturing
at all. It now offers three one-tap chips and lets you leave without choosing;
the omission surfaces in the landscape's attention list.

**D8 — Email capture by BCC address, not mailbox sync.** *Recommended: yes.*
Full Gmail sync means restricted-scope verification, an annual security
assessment, and asking data-minimisation customers for their mailbox. A BCC
address captures the outbound half with none of that. Revisit only if users
ask for inbound threading by name.

---

## Sources

- [CRM Implementation Failure Rate Explained 2026 — LOW/CODE](https://www.lowcode.agency/blog/crm-implementation-failure-rate)
- [CRM Statistics 2026 — Wave Connect](https://wavecnct.com/blogs/crm-statistics)
- [CRM adoption: why sales won't use it — Atypical Tech](https://atypicaltech.com/en/blog/the-sales-team-wont-use-it)
- [33 CRM Features Your Small Business Needs in 2026 — OnePageCRM](https://www.onepagecrm.com/blog/crm-features/)
- [Best CRM for Consultants: 9 Low-Admin Picks — Fluid CRM](https://fluidcrm.io/blog/crm-for-consultants/)
- [Capsule CRM vs Pipedrive 2026 — Tomba](https://tomba.io/blog/capsule-crm-vs-pipedrive)
- [Activities & Goals Management — Pipedrive](https://www.pipedrive.com/en/features/activities-goals)
- [The Rotting feature — Pipedrive Knowledge Base](https://support.pipedrive.com/en/article/the-rotting-feature)
- [Attio CRM Review 2026 — folk](https://www.folk.app/articles/attio-crm-review)
- [Best AI-Driven CRM for Automating Your Sales in 2026 — Pinggy](https://pinggy.io/blog/best_ai_driven_crm_for_automating_your_sales/)
- [What is a Nonprofit CRM? The 2026 Guide — DonorDock](https://www.donordock.com/articles/what-is-a-nonprofit-crm)
- [CRM for coaches: what it is and what to look for — Coachway](https://coachway.io/articles/crm-for-coaches/)
- [Notion CRM vs Airtable CRM for Agencies — Routine](https://routine.co/blog/posts/notion-airtable-crm-comparison)
