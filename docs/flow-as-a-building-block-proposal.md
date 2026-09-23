# Flow as a building block, not an app you choose

**Sjoerd, 2026-09-23:** *"Flows as a tech should be available in all apps — but
not as an app people can select (more as a building block for apps)."*

**Status:** proposal. Nothing in it is built. One consequence of it already
shipped in v0.108.0 and is described in §2, because it was fixing a live bug.

---

## 1. The finding: this is mostly already true

The interesting thing about this decision is how little of it is new. Flow's
tables are **already** the task-and-run substrate under other apps. Counted in
`apps/api/src` on 2026-09-23 — files writing or reading `flow_definition`,
`flow_run`, `flow_task`, `flow_run_note`:

| File | What it is |
|---|---|
| `routes/flow.ts` (40) | Flow the app |
| `routes/app-flow.ts` (18) | the published external-app surface |
| `lib/pulse-pipeline.ts` (10) | **Pulse** |
| `routes/notes.ts` (7) | **Connect's notes** |
| `lib/hygiene.ts` (4) | platform maintenance |
| `routes/my-tasks.ts` (3) | **To do** |
| `routes/connections-{today,map,teams,tags,agenda}.ts` (7) | **Connect** |
| `routes/pulse.ts` (1) | **Pulse** |

So five surfaces that are not Flow already depend on Flow's tables. A follow-up
you set while writing a note in Connect *is* a `flow_task`. Pulse's pipeline
runs on `flow_run`. Every one of those is the building-block use the decision
describes — built that way already, without anybody calling it that.

**What is NOT already true** is the packaging: Flow is still a catalogue app
with a seat, a tile, a sidebar and a URL, and things gate on holding that seat.
That is the part to change.

### What is actually out there (production, 2026-09-23)

- `app` row: `fibre-flow`, **approved**, first_party
- **2 workspaces** have it activated: The Thread B.V., Festival of Trust
- **4 people** hold a Flow seat
- **5** flow definitions, **56** runs, **363** tasks, **13** run notes

The data is real and must survive untouched. The seats and the tile are the
small part.

---

## 2. What already shipped, and why it could not wait

`v0.108.0` changed how the To do list decides who may see a task: **by where
the item was made, not by which table it lives in.**

A follow-up set on a note in Connect is stored as a `flow_task` but is a
Connect item — it needs a Connect seat, it is labelled Connect, and it links to
the person rather than to a Flow run. Recognised by
`flow_run_note.follow_up_task_id`, never by the title.

It could not wait because the old rule was a live bug: every such item sat
behind a **Flow seat**, so somebody using Connect without Flow never saw their
own follow-ups. Of the open items assigned to Sjoerd on production today, two
of two in soul.com and one of three in The Thread B.V. are Connect follow-ups.

That is the pattern the rest of this proposal generalises: **provenance, not
storage.**

---

## 3. What changing the packaging actually touches

### 3.1 The catalogue row
`app.status` already has the vocabulary: `pending → approved → suspended`. None
of those mean "exists, but is not something you select". Either a new status
(`internal`), or a new value of `kind` beside `first_party`. `kind` is the
better home: this is a statement about what Flow *is*, not about its review
state.

**Do not delete the row.** `app_id` tags curator data, activity events and
`app_membership`; and CLAUDE.md's own rule is to ask the catalogue rather than
hardcode which apps exist. The row stays; it stops being *offered*.

### 3.2 Where Flow is offered
- `apps/web/lib/apps.ts` — the launcher / profile-tab descriptor
- `apps/web/app/(app)/settings/apps` — the switch-on page
- `packages/shared/src/branding.ts` — name, tile, URL, `available`
- `apps/website/app/workshop/page.tsx` — the public page

`branding.ts` already carries an `available` flag, which is how `fibre-learn`
is registered but not offered. **That is the existing mechanism for exactly
this**, and it is probably most of the UI work.

### 3.3 Seats
4 people hold one. Two options:

- **(a) Retire the seat.** Anything that gated on `fibre-flow` gates on the
  app that made the item (§2). Flow's own screens then need a different rule —
  see 3.4.
- **(b) Keep the seat, stop selling it.** Existing holders keep it; nobody new
  gets one. Less clean, but nothing breaks on the day.

**Recommendation: (b) then (a).** They are separable, and (b) is reversible.

### 3.4 Flow's own screens
`apps/flow` has dashboard, flows, runs, tasks, contacts, settings, help. 56
runs and 5 definitions are being used. Someone has to be able to open them.

Options: keep the app reachable by URL for holders of the retired seat; or move
the builder to `/admin` as platform machinery; or fold the useful views into
the apps that own the work (Connect already shows runs and tasks on people).

**This is the real question in the proposal** and I do not think it should be
decided by inference. My recommendation is the third, over time, with the
second as the holding position — but it is a product call.

### 3.5 Billing
There is a `'flow'` plan feature in `lib/plan.ts`. **It is declared and never
checked** — nothing calls `can(ws, 'flow')`. So there is no revenue to unwind,
and the key can simply retire. Worth noting as a small separate finding: a
feature flag nobody reads is indistinguishable from one that is always on.

### 3.6 The published external-app contract
`routes/app-flow.ts` is part of `/api/v1/apps/*`, which is **additive-only** —
`fot-planner` runs against it in production. Flow's packaging can change;
**this surface cannot.** Whatever happens to the tile, these routes keep
answering exactly as they do.

---

## 4. What this makes possible

The reason to do it, beyond tidiness: **any app can then give someone a task**
without that person needing a seat in an app they have never heard of. To do
already merges them. Thread's "approve this enrolment", Meet's "confirm this
booking", Membership's "this renewal failed" are all the same shape, and each
one currently would have to either invent its own task table or borrow a Flow
seat.

---

## 5. What I would do first

1. `available: false` in `branding.ts` + remove from the launcher, settings and
   the workshop page. Flow stops being offered; nothing existing breaks.
2. Mark the catalogue row `kind: 'internal'`, and make `/admin/apps` show it as
   machinery rather than a pending review.
3. Retire the `'flow'` plan key (dead already).
4. Then, separately and with a decision from Sjoerd: §3.4, what happens to
   Flow's own screens.

Steps 1–3 are small, reversible and do not touch a single row of the 363 tasks.
Step 4 is the one worth thinking about.

---

## 6. Open questions

1. **§3.4** — what happens to the Flow builder's screens? (The one that needs
   an answer before anything irreversible.)
2. Does "available in all apps" mean other apps should be able to **create**
   runs and tasks through a shared helper, or only that their existing uses
   stop being second-class? The first is a bigger and more interesting piece.
3. Is `fibre-learn` — registered, unreleased, not offered — the same category
   as Flow will be, or a different one? If the same, `kind: 'internal'` wants a
   better name.
