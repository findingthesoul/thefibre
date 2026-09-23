// The day-buckets a To do list is grouped into — ONE list, because two
// pieces of code have to agree on these strings.
//
// They did not share them before: the API built
// `{ overdue, today, tomorrow, this_week, later, no_date }` and the panel
// carried its own `GROUP_ORDER` with the same six words typed again. Rename a
// bucket on one side, or add one, and the panel does not break — it silently
// DROPS that whole group of somebody's to-dos, because it only renders the
// keys it knows. Nothing fails; the items just are not there.
//
// That is the shape of two bugs on 2026-09-23 — a team picker whose query
// named a column that does not exist, and Connect's tag X keyed with
// toLowerCase() against ranges keyed with fold(). Both looked right and did
// nothing. The lesson, in the other session's words: when two pieces of code
// have to agree on a STRING, the test is that they AGREE, not that each works.
// So: one source, imported by both, and a test that pins the API's output to
// it.

/** In the order the panel draws them. */
export const TODO_GROUPS = [
  'overdue',
  'today',
  'tomorrow',
  'this_week',
  'later',
  'no_date',
] as const;

export type TodoGroupKey = (typeof TODO_GROUPS)[number];

/** An empty bucket per group — the shape every grouped answer starts from. */
export function emptyTodoGroups<T>(): Record<TodoGroupKey, T[]> {
  return Object.fromEntries(TODO_GROUPS.map((g) => [g, [] as T[]])) as Record<TodoGroupKey, T[]>;
}
