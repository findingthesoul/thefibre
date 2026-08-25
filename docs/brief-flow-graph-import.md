# Brief — import a flow design as JSON

_Written 2026-08-25, from seeding the Festival of Trust flow by hand._

## What this is

A flow's shape — steps, their order and grouping, their `meta`, their default
tasks, the transitions between them — is authored one field at a time in Flow's
builder. For a nine-step method with 39 default tasks and four `meta` fields per
step, that is an afternoon of typing, and a transcription error is invisible
until someone reads a step and finds the wrong trap under it.

The ask: **hand Flow a design file and have it build the flow.**

## Most of it already exists

`PUT /api/v1/flow/flows/:id/graph` (`routes/flow.ts`) already accepts exactly
that payload:

```ts
const Graph = z.object({
  steps: z.array(GraphStep).min(1),
  transitions: z.array(GraphTransition).default([]),
  step_default_tasks: z.array(GraphStepDefaultTask).default([]),
});
```

`GraphStep` already carries `key`, `name`, `description`, `kind`, `ordinal`,
`group_key`, `group_label`, `meta` and canvas coordinates. It is validated, it
is transactional in effect, and it is what the builder itself saves through.

**What is missing is only a way to give it a file.** There is no UI in
`apps/flow` that takes pasted or uploaded JSON. The endpoint, the schema and the
validation are all written; nothing calls them with authored input.

A working example payload is at
`~/Projects/festivaloftrust.com/supabase/seed/fot_festival_graph.json` — nine
steps, eight transitions, 39 default tasks, generated from the source of truth
rather than typed.

## What to build

An **Import design** action in the flow builder: paste JSON or choose a file,
see what it will do, apply.

Three things worth getting right:

### 1. Show what it will do before it does it

Saving a graph **wipes every step for the version and re-inserts them**
(`flow.ts:485`). That is fine on a draft nobody has run. It is not fine as a
surprise. A preview — *"9 steps replacing 0, 39 default tasks, 8 transitions"* —
turns a destructive operation into a decided one.

### 2. Decide what happens over a flow with runs

`ensureDraftVersion` protects published versions: an edit creates a new version
rather than mutating the one runs are pinned to. Import should ride that same
path rather than inventing a second one. But an import that silently creates a
new version of a live flow is worth naming in the UI, not just doing.

### 3. `progression` and `system_key` cannot travel in the graph

Both live on `flow_definition`, not on the version, so neither is in `Graph`.
That matters more than it sounds:

- **`progression`** is what makes a flow open rather than gated. A design for a
  self-paced method is not fully expressed without it.
- **`system_key`** is settable from **neither the UI nor the API** — it appears
  only as a read (`flow.ts:641`). Pulse's pipeline got its own from a migration.
  Any app that consumes a flow has to identify it somehow, and without
  `system_key` the only handle is the flow's name — which a human can rename,
  breaking the consumer silently.

This is why the Festival of Trust flow ships as SQL rather than as an import:
the import could not have set either field. Consider letting the design file
carry an optional flow-level block:

```jsonc
{
  "flow": { "progression": "open", "system_key": "fot_festival" },
  "steps": [...], "transitions": [...], "step_default_tasks": [...]
}
```

`system_key` should stay privileged — a workspace admin, not any editor — since
it is the handle other apps bind to.

### Worth adding alongside: export

`GET /flows/:id/graph` does not exist; only the PUT does. Adding the read makes
the format a round trip, which is what turns it from an import feature into a
way to copy a flow between workspaces, keep a method in version control, or
hand someone a starting point.

## Why it is worth doing

The Festival of Trust planner needs its nine steps in Flow, and that is the
immediate use. But the same method has two variations still to author, other
Solidarity Lab methods will follow, and each new workspace hosting a festival
needs the same nine steps seeded again. Every one of those is currently an
afternoon of typing or a bespoke migration.

It also closes a gap the external-app work opened: an app can *consume* a flow
but never author one, deliberately. That is the right boundary — but it means
the humans doing the authoring should have the best possible tool, and right now
the fastest path for a nine-step method is to write SQL against production.

## Reference

- `apps/api/src/routes/flow.ts` — `Graph`, `GraphStep`, `PUT /flows/:id/graph`,
  `ensureDraftVersion`, and the step wipe at line 485.
- `supabase/migrations/20260708120000_pipeline_flow_in_flow.sql` — how Pulse
  seeded a flow and set `system_key`, the precedent this replaces.
- `~/Projects/festivaloftrust.com/supabase/seed/fot_festival_flow.sql` — the
  same nine steps as SQL, which is what has to be run until this exists.
