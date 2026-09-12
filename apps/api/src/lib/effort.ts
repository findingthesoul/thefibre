// How long a piece of work on Today takes. connections-overview.md §3.
//
// Defaulted by KIND and never asked for. The kind comes from where the work
// came from, which the system already knows; a workspace can change a kind's
// minutes once, in settings (connections_effort_default), and nobody is ever
// asked for a number on a task.
//
// ── Two shapes of kind ──────────────────────────────────────────────────────
//
// A task is one piece of work: a follow-up is a follow-up.
//
// Some preparation is PER PERSON. "Four of the twelve have never been
// contacted" is four conversations, not one, and an estimate that ignored the
// count would make a thread with forty unreached people look as light as a
// thread with one. §3's own example is per-person: "four conversations to log
// at five minutes each".
//
// ── What is not here ────────────────────────────────────────────────────────
//
// Free time. "Fourteen hours of preparation and nine hours unbooked" needs the
// calendar's busy time next to these numbers, and the agenda route reads only
// today. That is the next half of 6b, named rather than faked.

export const EFFORT_KINDS = [
  // Tasks, by where they came from.
  'follow_up',
  'flow_step',
  'task',
  // Preparation, one per Today signal.
  'meeting_brief',
  'thread_unreached',
  'thread_unpaid',
  'money_uninvoiced',
] as const;
export type EffortKind = (typeof EFFORT_KINDS)[number];

export function isEffortKind(k: string): k is EffortKind {
  return (EFFORT_KINDS as readonly string[]).includes(k);
}

/**
 * The shipped defaults, in minutes. Starting points a workspace will adjust,
 * not measurements — each carries its reasoning so the next person to change
 * one knows what they are disagreeing with.
 */
export const DEFAULT_MINUTES: Record<EffortKind, number> = {
  /** A message or a short call, and writing down what was said. */
  follow_up: 15,
  /** A step in a journey is usually more than a message: a form, a check, an
   *  introduction. Half an hour until a workspace says otherwise. */
  flow_step: 30,
  /** Anything written down by hand with no known origin. */
  task: 30,
  /** §3 and connections-mobile.md §3 both say ten minutes to read a brief. */
  meeting_brief: 10,
  /** Per person: reaching somebody who has never been contacted. */
  thread_unreached: 10,
  /** Per person: a reminder about payment. */
  thread_unpaid: 5,
  /** Writing and sending one invoice. */
  money_uninvoiced: 15,
};

/** Kinds whose minutes multiply by how many people the row counts. */
export const PER_PERSON: ReadonlySet<EffortKind> = new Set(['thread_unreached', 'thread_unpaid']);

export type EffortOverrides = Partial<Record<EffortKind, number>>;

/** A kind's minutes for ONE unit of work, after the workspace's override. */
export function minutesPerUnit(kind: EffortKind, overrides: EffortOverrides = {}): number {
  const o = overrides[kind];
  return typeof o === 'number' && Number.isFinite(o) && o >= 0 ? o : DEFAULT_MINUTES[kind];
}

/**
 * Minutes for one row on Today.
 *
 * `count` is the number of people a per-person row is about. A per-person row
 * with no count is counted once rather than as zero — an estimate that
 * silently vanished would under-report a week, which is the one error this
 * feature exists to prevent.
 */
export function effortFor(
  kind: EffortKind,
  count: number | null,
  overrides: EffortOverrides = {},
): number {
  const unit = minutesPerUnit(kind, overrides);
  if (!PER_PERSON.has(kind)) return unit;
  const n = typeof count === 'number' && count > 0 ? count : 1;
  return unit * n;
}

/**
 * The kind of a task, from where it came from.
 *
 * A follow-up is recognised by the note that created it, never by its title:
 * the title is "Follow up" in English today and anybody may rename a task.
 */
export function taskKind(
  task: { step_default_task_id: string | null; gate_task_id: string | null },
  isFollowUp: boolean,
): EffortKind {
  if (isFollowUp) return 'follow_up';
  if (task.step_default_task_id || task.gate_task_id) return 'flow_step';
  return 'task';
}
