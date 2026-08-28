# Bug — a step's tasks come back in arbitrary order

_Found 2026-08-25, running the Festival of Trust planner against a real flow._

## What happens

`GET /apps/:slug/flow/runs/:id` returns each step's tasks in an order unrelated
to how they were authored. Seeding the nine-step festival flow and reading the
run back:

```
listen, as authored              listen, as returned
0 Have unhurried conversations   0 Name who is gathering
1 Ask how trust grows here       1 Listen for the pockets of trust
2 Name who is gathering          2 Resist pitching a festival
3 Listen for the pockets         3 Have unhurried conversations
4 Resist pitching a festival     4 Ask how trust grows here
```

All nine steps are affected. Order differs again between reads.

## Why

Two things together:

1. **`flow_task` has no `ordinal` column.** It carries `step_default_task_id`
   back to the template it came from, but nothing recording its own position.
2. **`app-flow.ts:417` orders by `created_at`.** Every default task for a run is
   materialised in one batch, so the timestamps are identical or near enough
   that the order is whatever Postgres returns.

So `flow_step_default_task.ordinal` — which an author sets deliberately — is
discarded the moment a run starts.

## Why it matters more than it looks

For a checklist, order is cosmetic. For a method, it is the content.

The festival planner's tasks are sequential guidance: *have the conversations*,
then *ask how trust grows*, then *name who is gathering*. Shuffled, they read as
a bag of chores. The planner's own specification is explicit that the early
steps are relational and "must not be reduced to checkboxes" — arbitrary order
does exactly that reduction, and no consumer can undo it, because the ordering
information never left the database.

It is also invisible: nothing errors, the count is right, and only someone who
knows the authored order can tell.

## Suggested fix

Add `ordinal` to `flow_task`, populated at materialisation from
`flow_step_default_task.ordinal` (and from `flow_gate_task.ordinal` for gate
tasks), then order by it with `created_at` as the tie-break so manually added
tasks fall at the end in the order they were added.

Ordering by the template through the join would work for seeded tasks but leaves
manual ones — which have no template — unplaceable, so a real column is the
better answer.

Worth checking Flow's own UI at the same time: it reads `flow_task` through a
different path, so it may or may not show the same shuffle.

## Reproducing

Any flow whose step default tasks have meaningful order. The festival flow is
seeded by
`~/Projects/festivaloftrust.com/supabase/seed/fot_festival_flow.sql`, and the
authored order is in `src/lib/festival-plan.ts`.
