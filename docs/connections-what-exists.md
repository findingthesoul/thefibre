# Simple Sales — an exploration

*Written 2026-09-10 against v0.68.70, in response to Sjoerd: "Can we bring the
simplest CRM we can imagine, based on Fibre, Flow and Pulse… feeding back into
Meet" — tracking initial contact, conversations, follow-up, proposals,
offerings, deals, growth — plus "day planning, agenda work, tasks".*

Status: **exploration, nothing built.** Decisions D1–D6 in §7 are for Sjoerd.

> **Companion, and amendments.** [`connections-market.md`](connections-market.md)
> analyses what other CRMs do and what the adoption data says people
> actually need. It amends this document in four places: it corrects the
> initial-contact row below, adds deal **rotting** to the build order,
> moves **growth** earlier, and replaces the shrug about email in §8 with
> a real answer. Its §7 carries the revised build order and its §9 adds
> decisions **D7** and **D8**. A third,
> [`connections-calendar.md`](connections-calendar.md), covers scanning and
> planning in the calendar — and **revises D4 below**: the fourth data-wall
> crossing is dropped in favour of reading the user's own calendar, which
> Fibre can already do on scopes users have granted. Read all three before
> building.

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

## 1. The finding

Simple Sales is roughly 70% built already, and nobody assembled it.

Between 2026-07-07 and 2026-07-15, Pulse and Flow were wired together into
something that is, structurally, a CRM. The pipeline is a real
`flow_definition` named "Pipeline" with `system_key = 'pulse_pipeline'`, seeded
per workspace, undeletable while Pulse is active
(`20260708120000_pipeline_flow_in_flow.sql`). Every opportunity is a
`pulse_commitment` that mirrors into a `flow_run`, and moving the run in Flow
moves the stage in Pulse (`20260709080000_flow_run_external_subjects.sql`).
Offerings are `pulse_offering`. Proposals have a `quote_url` and line items
with per-row expected payment dates. Stages carry money semantics — `open`
weights by probability, `committed` counts at 100%, `lost` is excluded from
every layer.

The division of labour was already decided, in Sjoerd's own words in the
migration comments: **Pulse speaks cashflow, Flow owns the pipeline.** The
Pulse `/pipeline` route is a redirect to `/cashflow` for exactly that reason.

So the question is not "what do we build". It is "what three things are
missing, and where does the assembly surface live".

---

## 2. The seven verbs, mapped

| Verb | Exists today | Gap |
|---|---|---|
| **Initial contact** | `person`, `organisation`, `org_relationship.relationship_stage` (prospect / engaged / active_client / alumni / dormant / lost), and a fuller relationship record than most CRMs ship: `person_relationship_context` holds `source`, `introduced_by`, `relationship_strength`, `first_contact_notes`, `first_contact_at`, with a live API | Nothing *surfaces* any of it during a sale — it is a profile tab you never open. No one-field "add a lead": you make a person, then make an opportunity, two dialogs. `org_relationship` is written by nothing. |
| **Conversations** | `activity` records that a thing happened. `flow_run_note` holds a body, but only against a (run, step) pair. Meet writes an activity row when a booking is approved. | **The main gap.** No place to write "I spoke to Marja, here is what she said" against a person who is not yet in a flow run. |
| **Follow-up** | `flow_task` with `due_at`, `assignee_user_id`, manual ad-hoc creation already in Flow's Tasks page. `org_relationship.next_planned_contact` exists. | Nothing surfaces overdue. No way to say "follow up in three weeks" from where the conversation happened. |
| **Proposals** | `pulse_commitment` at stage `proposal`, `pulse_commitment_item` lines with VAT, `quote_url` | The proposal is a link you paste. Fibre does not produce the document. |
| **Offerings** | `pulse_offering` — name, category, default amount, archived_at | An offering is not connected to what gets delivered. Selling "a two-day facilitation" does not know it becomes a Thread, a Meet meeting type, or a Membership tier. This is the "feeding back into Meet" hook, and it is empty. |
| **Deals** | `pulse_commitment` (direction `in`), stage from `pulse_stage`, mirrored as a `flow_run`, projected into cashflow, reconciled against the `purchase` ledger | Won deals do not hand over to delivery. The build plan's old Phase 4 called this "handover webhook on `deal_won`" and it was never built. |
| **Growth** | `pulse_projection_snapshot`, `pulse_budget_target`, `/admin/economics` at workspace level | Per-relationship growth is unwritten. `org_relationship` has `touchpoints_count`, `last_touchpoint_at`, `total_participants_reached`, `health_status` — every field a growth view needs, all of them null. |

---

## 3. What is actually missing

Three things, in order of how much they unlock.

### 3.1 A conversation log — one table

The data wall says activity carries type and subject, never a body. That rule
is right and should stand. But a CRM without conversation notes is a list of
names, and Fibre currently has exactly one place a body can live against a
person: `flow_run_note`, which requires a run.

**Proposal: widen `flow_run_note` into `flow_note`.** One migration, additive:

- `flow_run_id` becomes nullable
- add `person_id`, `organisation_id` (at least one of note/person/org present)
- add `kind` — call, meeting, email, message, note
- add `happened_at` (distinct from `created_at`, because you log Tuesday's call
  on Thursday)
- add `follow_up_at` — setting it materialises a `flow_task`, so a follow-up is
  never a second concept

Writing a note also writes one `activity` row: type `fibre-flow.touch.logged`,
subject the first 200 characters or a fixed label. The body never crosses. The
Fibre timeline then shows the shape of a relationship without holding its
content, which is the wall working as designed.

The alternative — a new `sales_*` schema — buys nothing and costs an app.

### 3.2 Every next action is a `flow_task`

This is the simplifying move, and it is free. `flow_task` already handles gate
tasks, step default tasks and manual tasks, with due dates, assignees and
actor types. If follow-ups from notes materialise as tasks, and delivery
handovers materialise as tasks, then **"what do I owe anyone" is one query**,
and the day surface in §5 is a join rather than a feature.

Do not add a second to-do concept anywhere.

### 3.3 An offering knows what it becomes

`pulse_offering` gains a nullable delivery pointer: `delivers_app` +
`delivers_ref` (a Thread template id, a Meet meeting type id, a Membership
tier id). When a deal reaches a `won` stage, Flow creates a handover task —
"set up the Thread for EBBF Athens" — pre-linked to the template.

Deliberately a task, not an automation. Automatic Thread creation on deal-won
is the kind of thing that is wrong 20% of the time and then you are cleaning
up. One click from a task is close enough and stays honest.

---

## 4. The shape: Sales is a lens, not an app

The naming brief (§ "Sales") already decided this: *"CRM tool for moving a
prospect toward becoming a Thread. Built on Fibre and Flow together. Operator
facing."* Functions serve Thread; they are not siblings.

So: **no eighth app.** The build plan's "Phase 4 — Fibre Sales (gated app)"
should be struck. Four surfaces instead, three of which exist:

| Surface | Where | State |
|---|---|---|
| The board — opportunities by stage, drag to move | Flow, the Pipeline flow's kanban | **Exists.** Needs the contact context panel. |
| The money — weighted pipeline, expected dates, cashflow | Pulse → Cashflow | **Exists.** |
| The relationship — who they are, every touch, open deals | Fibre web, contact profile, as a per-app tab | Tab machinery exists (`GET /persons/:id/apps`). The Flow tab renders once §3.1 gives it rows. |
| The day — what I owe, who I am seeing | New. See §5. | Missing. |

Everything a salesperson does is then already-shared components: the contact
profile is the platform's, the invoice screen is the platform's, ordering is
drag-and-drop. Per the components-first rule, nothing here gets a per-app fork.

---

## 5. Day planning — and the fourth crossing

"Day planning, agenda work, tasks" is a different surface from the pipeline,
and it is the one that would get used every morning.

What a day is made of:

- `flow_task` due today or overdue — follow-ups, gate tasks, handovers
- `meet_booking` today — the actual conversations
- Thread events today, for whoever is organising
- `pulse_commitment_item.expected_date` landing this week — money to chase

Three of those four live in other apps' tables. **Reading them from Flow is a
fourth data-wall crossing**, and the contract says explicitly: *"If you find
yourself wanting a fourth crossing, that is a conversation to have before you
build."* This is that conversation.

**Proposal: the agenda crossing. — Superseded, see
[`connections-calendar.md`](connections-calendar.md) §4.** Read-only, and shaped exactly like activity
so the precedent holds — `starts_at`, `title` (≤200 chars), `app_id`, a deep
link, an optional person. No body, no payload, no attendee list, no agenda
content. Each app contributes a resolver; the platform serves
`GET /api/v1/agenda?from=&to=`. It is the mirror image of activity: activity is
what happened, agenda is what is scheduled, and both carry only type and
subject.

Built as `@thefibre/shared/ui/today` so Flow, Meet and Thread all render the
same day from the same feed. Flow gets it first, because tasks already live
there and its dashboard already says "moving today".

If D4 says no fourth crossing, the fallback is a Flow-only Today showing tasks
and money dates but no meetings — noticeably less useful, and people will keep
their calendar in a second window.

---

## 6. Build order

Each step is shippable on its own and useful before the next one lands.

1. **`flow_note`** — the migration, the API, a note composer on the contact
   panel and on a run. Follow-ups materialise tasks. Writes one activity row.
   *Half a session. Unlocks everything else.*
2. **Contact context in the pipeline** — the board's side panel shows recent
   touches, open tasks, past purchases from the ledger, and the org's
   relationship stage. *Reads only, no new tables.*
3. **`org_relationship` gets written** — `last_touchpoint_at` and
   `touchpoints_count` derive from notes; `relationship_stage` becomes an
   editable field on the org profile. Retires a dead table.
4. **Today, in Flow** — tasks and money dates first. Meetings when D4 lands.
5. **Offerings know their delivery** — `delivers_app` / `delivers_ref`,
   handover task on won. The Meet and Thread loop closes here.
6. **Growth view** — per-org lifetime value from the purchase ledger, touch
   cadence from notes, at-risk from silence. Last, because it is a read over
   everything above.

Steps 1–4 are the CRM. Steps 5–6 are why it is on Fibre rather than in a
spreadsheet.

**Superseded** by the revised order in the landscape doc §7, which inserts
rotting at position 2 and moves growth up to position 4.

---

## 7. Decisions for Sjoerd

**D1 — No eighth app.** Sales is a lens over Flow + Pulse + Fibre, not a
sovereign app. Strike "Phase 4 — Fibre Sales" from the build plan.
*Recommended: yes.* It matches the naming brief and it is the difference
between one week and one month.

**D2 — Widen `flow_run_note` into `flow_note`** rather than starting a Sales
schema. *Recommended: yes.* One migration, one concept, no new app membership.

**D3 — Every next action is a `flow_task`.** Follow-ups, handovers, chases —
all of them. *Recommended: yes,* and it should be a hard rule so a second
to-do list never appears.

**D4 — The agenda crossing. ~~Recommended~~ SUPERSEDED — see
[`connections-calendar.md`](connections-calendar.md) §4 and §7.** Meet already
writes real Google Calendar events, and Fibre already holds calendar read +
write scopes, so Today can read `flow_task` plus the user's own calendar and
no crossing is needed. The original question, kept for the record: do we
sanction a fourth data-wall crossing,
read-only, `starts_at` + title + link + app, no body? *Recommended: yes* — it
is symmetric with activity, it is the only way Today includes meetings, and
the constraint is the same one activity already survives. **That reasoning was
wrong on one fact** — it assumed Fibre could not see the meetings. It can.

**D5 — Handover is a task, not an automation.** Winning a deal creates "set up
the Thread", pre-linked, one click. *Recommended: yes.*

**D6 — Does Fibre produce proposal documents,** or does `quote_url` stay a
link to something made elsewhere? *Recommended: link for now.* Document
generation is a real project — templates, branding, versioning, PDF — and it
is not what makes this a CRM. Revisit once offerings carry delivery pointers,
because then there is something to generate from.

---

## 8. What this does not cover

- Mailbox sync. No two-way inbox connector, no thread capture. **Amended by the
  landscape doc §6:** logging every conversation by hand is the thing that kills
  CRM adoption, so the answer is not "by hand" but a per-user BCC address —
  no Google scopes, no restricted-scope verification, captures the outbound
  half. Decision D8.
- Forecasting beyond what Pulse already projects.
- Lead scoring, sequences, campaigns. Not this product's shape.
- Multi-currency deals — Pulse handles currency; whether the pipeline needs to
  is untested.
