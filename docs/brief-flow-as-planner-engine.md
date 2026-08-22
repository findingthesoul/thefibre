# Brief — Fibre Flow as the engine under the Festival planner

_Written 2026-08-22. Revised the same day after checking the claims against the
live schema and API — two of the five gaps had already been closed by
migrations that postdate the original Flow schema file, and the crux was
mis-identified. See "Revision note" at the end._

## The idea

The Festival of Trust planner walks an organiser through nine fixed steps
(Listen → Gather → Align → Connect → Design → Invite → Host → Harvest → Grow),
each with suggested tasks, a "watch for" warning, a reflection question, a
free-text note, and linked people.

It is currently built standalone in `~/Projects/festivaloftrust.com`
(`/plan`, saving to browser local storage). That is a placeholder.

The proposal: **Flow runs the nine steps underneath, and the planner is a
presentation layer on top.** One engine for sequences, many faces.

## Why it is a good fit

Flow already models nearly all of it (`supabase/migrations/20260520120000_fibre_flow_schema.sql`):

| Planner concept | Flow table |
|---|---|
| The nine-step process, versioned | `flow_definition` + `flow_version` |
| A step | `flow_step` (`key`, `name`, `description`, `ordinal`) |
| Suggested tasks seeded per step | `flow_step_default_task` |
| One festival's journey | `flow_run` |
| A checkable task | `flow_task` (`open`/`in_progress`/`done`) |
| A reflection note per step | `flow_run_note` (`flow_run_id`, `step_id`, `body`) |
| People linked to the work | `flow_task.contact_id`, `gate_task.actor_type='contact'` |
| Progress | derived from `flow_task` counts |

The planner's own status rule (none checked = not started, some = in progress,
all = done) falls straight out of `flow_task` statuses. Nothing to invent.

**There is a precedent for the whole move.** Pulse's sales pipeline is a real
`flow_definition` marked `system_key = 'pulse_pipeline'`, presented inside Pulse
as something that looks nothing like a flow
(`supabase/migrations/20260708120000_pipeline_flow_in_flow.sql`). That migration
also established flow definitions as the **third sanctioned data-wall crossing**,
after the activity log and the purchase ledger: "any in-family app may read them
via the API". The planner is asking for the same arrangement, not a new one.

---

## The crux: Flow is a single cursor, the planner is nine open doors

The original version of this brief framed the mismatch as gating — Flow holds
contacts at gated steps, the planner must never nag. That is real but secondary,
and it is already softer than it looks:

- `POST /runs/:id/transition` accepts an `override_reason` and lets any
  unsatisfied gate through (`apps/api/src/routes/flow.ts:1053`).
- A gate with no `required` tasks always passes (`gateSatisfied`, line 857).

So "gates advisory" is nearly free. The hard constraint is one line earlier
(`apps/api/src/routes/flow.ts:1034`):

```ts
if (!trans || trans.from_step_id !== run.current_step_id) {
  return c.json({ error: 'transition does not start from the current step' }, 400);
}
```

A run **is** a cursor. It sits on exactly one `current_step_id` (`not null`) and
may only walk authored edges. The planner's specification says the opposite:

> Order is fixed 1 to 9, but any step can be opened at any time. **Do not lock
> later steps.**
>
> A step is never 'failed' or overdue. **No deadlines, no nagging. This is a
> companion, not a taskmaster.**

Nine steps, each with an independent status, all live from day one. No amount of
loosening gates reaches that — it is the cursor itself that has to go.

### Two consequences that follow from it

**`flow_task` has no `step_id`.** Which step a task belongs to is derived — via
`step_default_task_id → flow_step_default_task.step_id`, or via
`gate_task_id → flow_transition.from_step_id`. A manually created task has
neither, so today it cannot be filed under a step at all. The planner needs the
organiser to add their own task under step 4. This needs a real column.

**Default tasks materialise on step entry.** The runtime seeds
`flow_step_default_task` rows into `flow_task` when a run *lands* on a step. The
planner needs all nine steps' suggested tasks present at run creation, because
all nine are browsable immediately.

### The three ways out, re-scored

**A. Flow gains an open (companion) mode.** A `progression` flag on
`flow_definition` (`'gated' | 'open'`). For open flows: `current_step_id`
nullable, every step's default tasks materialised at run creation, gates
advisory, no due dates, no overdue anywhere. Larger than the original brief
implied — it is a flag *plus* a nullable column *plus* `flow_task.step_id` *plus*
a materialisation change — but each piece is small and independently useful.

**B. Use Flow's storage, not its semantics.** Worse than it first appears. With
no meaningful cursor *and* no `step_id` on tasks, the rows are not something
Flow's own board, run popup or reports can render. You would be writing into
tables that only one app can read correctly — which is the definition of the bug
the next person finds.

**C. Extract the shared primitive.** Steps-and-tasks-against-a-subject as a base
both Flow and the planner sit on. Cleanest end state, most work, and hard to
justify for a second consumer.

**A remains the recommendation**, now on firmer grounds: "a sequence you move
through at your own pace" is a real recurring shape (onboarding, learning paths,
anything self-directed), and `flow_task.step_id` is a fix Flow wants regardless
— manual tasks losing their step is a defect today, not a planner requirement.

Whichever is chosen, one rule holds: **the engine may be able to express
lateness; the planner must never surface it.** A schema that can represent an
overdue festival step will eventually show one.

---

## What Flow is missing

### ~~1. `flow_run.person_id` is `not null`~~ — already fixed

Closed on 2026-07-09 by
`supabase/migrations/20260709080000_flow_run_external_subjects.sql`, for the
Pulse↔Flow integration. `person_id` is now nullable, and the migration added:

- `subject_label` — what to display when there is no person
- `source_app` / `source_ref` — which app owns the mirrored item, unique per
  flow so syncs are idempotent

A festival run is therefore `organisation_id` = host org, `subject_label` =
festival name, `source_app` = `'fot-planner'`, `source_ref` = the planner's own
plan id. No schema change needed, and the idempotency index makes repeated
syncs safe for free.

### ~~2. No free-text note per (run, step)~~ — already exists

`flow_run_note` landed 2026-05-30
(`supabase/migrations/20260530100000_flow_run_note.sql`) with exactly
`(flow_run_id, step_id, body, created_by, created_at, deleted_at)`.

Two things to decide, neither structural:

- It is an **append log** of notes, not one editable body per (run, step). The
  planner wants a single reflection that gets rewritten. Upsert one row per
  pair, or take last-wins — do not add a table.
- **Permissions.** Its RLS is `current_workspace_id() + has_app_membership('fibre-flow')`,
  i.e. workspace-wide to Flow members — not private to the organiser and their
  core group, as the planner's reflections should be. Worse for the external-app
  path: `fot-planner` reading these rows would need Flow membership. Gate on run
  membership instead.

### 3. No phase grouping on steps

Still open. The nine steps group into three phases — orientation (1–3), doing
(4–6), culmination (7–9) — which drive the whole visual system. `flow_step` has
`ordinal`, `kind`, `canvas_x/y`; no grouping.

A nullable `group_key` / `group_label` on `flow_step` covers it and is useful to
any flow long enough to need sections.

### 4. Steps carry one description, the planner needs three

Still open. Each step has a **purpose** (one-line intent), a **trap** ("watch
for"), and a **reflection** (open question). `flow_step` has `name` +
`description`.

Add `meta jsonb` rather than three columns. This is the curator-data problem in
miniature, and hard-coding one app's three fields into the platform step table
invites the next app's four. Note that `flow_step` has taken no new columns since
it was created — only its `kind` check widened for `'loop'` — and that restraint
is worth keeping.

### 5. Variation

Still open. A single toggle (`communities` | `organisations`) swaps a subset of
suggested tasks and some copy — not the structure. Two published `flow_version`
rows would model it, at the cost of keeping them in step. Worth deciding whether
variation belongs in Flow at all or stays in the layer.

### 6. `flow_task.step_id` (new — see the crux)

A task's step should be a stored fact, not a join through whichever template
happened to create it. Manual tasks currently have no step at all. Backfill from
`flow_step_default_task.step_id` and `flow_transition.from_step_id`.

---

## Ordering note

This depended on `docs/brief-external-apps.md`, and that dependency **closed on
2026-08-22** — v0.14.0 ("The Fibre welcomes external apps", `da75bad`) opened the
app catalogue, added `app_key` credentials scoped to (app x workspace), made
scopes enforceable, and added organisation links, which the planner's declared
`festival_host` mapping needed. The planner can hold a real Fibre app identity
now, without living in this monorepo.

What that shipped does **not** cover is Flow. Two concrete gaps:

- **No flow scope exists.** `APP_SCOPES` in `apps/api/src/lib/app-keys.ts` runs
  persons / organisations / activities / curator_data. Nothing for flows.
- **No flow route is reachable by an app key.** The allow-list in
  `apps/api/src/middleware/app-context.ts:140` is default-deny and lists only
  links, manifest, activities and whoami. `/api/v1/flow/*` is not on it.

So an external planner would need, at minimum, a `read:flows` + `write:flow_runs`
pair and the corresponding allow-list entries. That is the shape v0.14.0 §3
intends — widening an app's surface as a deliberate edit — so this is following
the pattern, not fighting it. It is also the moment to settle the `flow_run_note`
permission question above: an external reader has no `has_app_membership('fibre-flow')`
to satisfy, so the note policy has to be expressed as an API rule regardless.

The remaining choice is unchanged in substance: bring the planner in-monorepo as
`apps/planner` and read Flow directly, or keep it external and pay for the scope
and route work. External is now genuinely viable, which it was not when this
brief was first written.

## Reference

- The nine steps with seeded tasks, traps and reflections:
  `~/Projects/festivaloftrust.com/src/lib/festival-plan.ts`
- The specification this came from:
  `~/Downloads/festival-planner-build-prompt.docx`
- The external-app pilot's own account of the integration:
  `~/Projects/festivaloftrust.com/docs/fibre-integration.md`
- Proposed standalone tables, if Flow is *not* used:
  `~/Projects/festivaloftrust.com/docs/planner-persistence.md`

**Content caveat:** the tasks, traps and reflections in `festival-plan.ts` are
placeholders. The spec sources them from "manual documents A2", which are not on
this machine. Do not treat them as approved copy.

---

## Revision note

The first draft was written from `20260520120000_fibre_flow_schema.sql` alone and
missed the later migrations. Corrections made:

1. Gap 1 (`person_id not null`) — closed 2026-07-09, struck through and replaced
   with how to use what exists.
2. Gap 2 (no per-step note) — `flow_run_note` has existed since 2026-05-30.
   Replaced with the two real questions: single-body vs log, and RLS scope.
3. The crux was "Flow gates, the planner must not". Gating turns out to be soft
   already (override reasons; empty gates always pass). The actual blocker is the
   single `current_step_id` cursor, plus `flow_task` having no `step_id` and
   default tasks only materialising on entry. Option A is still the
   recommendation; it is bigger than described, and option B is worse.
4. Added the Pulse pipeline precedent, which is the strongest argument that this
   pattern is supported rather than novel.
5. The ordering note said this brief waits on `docs/brief-external-apps.md`.
   That shipped as v0.14.0 the same afternoon, so the note was rewritten: the
   catalogue blocker is gone, and what is left is Flow-specific — no flow scope
   in `APP_SCOPES`, no flow route on the app-key allow-list.
