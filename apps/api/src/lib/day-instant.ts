// A date-only column has no time in it. Everything downstream wants an
// instant. This is where that conversion is decided, once.
//
// MIDDAY, not midnight — and the difference is visible on the screen.
//
// Connect's Today turns a row's timestamp into a number of days with
//   Math.round((new Date(due_at) - now) / DAY)
// and the API's own `daysBetween` below is the same expression. Against
// MIDNIGHT that rounds DOWN for most of the working day. Measured, for a row
// dated today:
//
//   now 06:00Z →  0      now 13:00Z → -1
//   now 09:00Z →  0      now 15:00Z → -1
//   now 12:00Z →  0      now 18:00Z → -1
//
// So a thing due TODAY reads "yesterday" from 12:00Z onwards — 14:00 in
// Amsterdam in summer — and a thing two days out reads as one. Nothing
// throws; the row is otherwise perfect. It is the kind of thing somebody
// reports as "Today is wrong about money" and nobody can reproduce in the
// morning.
//
// Midday is the only point in the day where that rounding gives the right
// answer at every hour it might be read at, because it is the furthest
// possible instant from both day boundaries.
//
// Two consequences worth keeping:
//   - Segmentation is unaffected. "today" means "before tomorrow starts",
//     which midday today satisfies exactly as midnight did.
//   - A tie on a segment boundary is DEFINED, not ambiguous: the segments
//     are `at < tomorrowStart` and `at >= tomorrowStart`, a total partition,
//     so an instant landing exactly on one is in exactly one segment. Moving
//     midnight→midday shifts a derived `prepare_at` by twelve hours and can
//     therefore move a row one segment — deterministically, and with a label
//     that is now right rather than a day out.
//     Note midday UTC is NOT universally far from a boundary: for a
//     workspace at UTC±12 (Pacific/Auckland in NZST) it IS local midnight.
//     That was asserted here and the assertion failed, which is how this
//     sentence came to be accurate. It still lands in one segment.
//
// OVERDUE is always a comparison of DATES, never of this timestamp: a day is
// late when the day has passed, not when a clock inside it has.
//
// Found 2026-09-23 by the thread session, on the screen, after every content
// assertion passed. Then found a second time in the money branch of the same
// route, where the belief "it is computed server-side, so it is unaffected"
// had left it standing — the location of the arithmetic was never the thing.
// The shape of the instant was.

export const DAY_MS = 86_400_000;

/** Noon UTC on a `YYYY-MM-DD` day. The only safe instant for a date-only
 *  column that will later be rounded into a number of days. */
export function dayInstant(dateOnly: string): Date {
  return new Date(`${dateOnly}T12:00:00.000Z`);
}

/** Whole days from `now` to `at`, positive for the future. Takes `now` as an
 *  argument rather than reading the clock, so the rule can be tested at any
 *  hour instead of being green in CI and wrong at 23:00. */
export function daysBetween(at: Date, now: Date): number {
  // `|| 0` normalises -0, which Math.round returns for a small negative and
  // which `Object.is(-0, 0)` calls a different number. It never reaches JSON
  // (JSON.stringify(-0) is "0"), but it makes a strict test fail for a reason
  // that has nothing to do with days.
  return Math.round((at.getTime() - now.getTime()) / DAY_MS) || 0;
}
