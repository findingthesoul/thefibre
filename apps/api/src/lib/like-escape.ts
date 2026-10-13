// A value that must be matched LITERALLY by a case-insensitive comparison.
//
// `.ilike(column, value)` hands the value to SQL's ILIKE, where `%` matches
// anything, `_` matches one character and `\` escapes. A value typed by a
// member of the public is therefore a PATTERN unless it is escaped — and on
// 2026-10-13 that was a live hole on the public enrol form: a visitor typing
// `%` as the discount code matched whatever single active code the thread
// had, and got its discount without ever knowing it. Measured against staging
// before the fix: typing `%` matched EARLYBIRD.
//
// `.eq()` is the right tool when the comparison can be exact. Where it cannot
// — codes are compared case-insensitively on purpose, so somebody typing
// `earlybird` gets `EARLYBIRD` — the value is escaped and ILIKE is used for
// its case folding alone, never for its wildcards.
//
// The same shape as the PostgREST `.or()` rule (docs: never interpolate into
// a filter): what a stranger types is data, and a query builder that treats
// data as syntax is the bug.

/** Escape the metacharacters so the value matches only itself. The backslash
 *  goes first — escaping it after the others would escape the escapes.
 *
 *  `*` IS ONE OF THEM. PostgREST accepts `*` as an alias for `%` in a
 *  `like`/`ilike` filter, so escaping only SQL's own metacharacters leaves the
 *  hole open through the layer we actually call: measured against staging,
 *  `*`, `E*` and `*BIRD` all still matched EARLYBIRD after the first fix, and
 *  stopped once `*` was escaped. The lesson is the plain one — the rules that
 *  matter are the ones of the thing you are really talking to, and a unit
 *  test on a string transformation could not have told me this. */
export function likeLiteral(value: string): string {
  return value.replace(/([\\%_*])/g, '\\$1');
}

/** May this be stored as a code at all?
 *
 *  A code containing `*` cannot match itself once `*` is escaped: PostgREST
 *  turns the escaped `\*` into `\%`, a literal percent — so the code would
 *  only ever be found by somebody typing a percent sign. `%` has the mirror
 *  problem. Rather than carry that ambiguity, codes simply may not contain
 *  either: nobody wants a discount code with a wildcard in it, and refusing
 *  it at the door is better than a code that exists and cannot be redeemed. */
export function isStorableCode(value: string): boolean {
  return !/[%*]/.test(value);
}
