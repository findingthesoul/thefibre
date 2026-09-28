// IANA time zones, checked rather than assumed.
//
// Written 2026-09-28, the evening one row took The Thread down. A thread
// carried the timezone `Athenes/Greece` — invented, not an IANA zone, and
// stored because the API accepted any string under 100 characters. Every
// signed-in page of the app then died server-side with
// `RangeError: Invalid time zone specified: Athenes/Greece`, because the
// renderer's guard was `timezone || 'Europe/Amsterdam'` and a non-empty
// wrong string sails straight past `||`.
//
// So there are two jobs here and a surface needs BOTH:
//
//   isTimeZone     — refuse the value at the door, where it is being stored.
//   resolveTimeZone — survive the value already in the table, where it is
//                     being rendered.
//
// Validating writes alone leaves every row written before today lethal.
// Falling back on read alone lets nonsense keep arriving and quietly renders
// somebody's Athens programme in Amsterdam time. One row of bad data must
// never be able to take a page down, and it must also not get in.

/** The zone every surface falls back to when it has nothing trustworthy. */
export const DEFAULT_TIME_ZONE = 'Europe/Amsterdam';

/**
 * Is this a time zone the runtime actually knows?
 *
 * There is no list to compare against — the set is the runtime's, it differs
 * between Node versions and browsers, and any list we wrote here would be a
 * second source of truth that goes stale. So we ask the only authority there
 * is, by trying it: `Intl` throws a RangeError for a zone it does not know.
 */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * The zone to actually format in: the given one when it is real, the fallback
 * otherwise. Never throws — that is the whole point of it.
 */
export function resolveTimeZone(
  value: string | null | undefined,
  fallback: string = DEFAULT_TIME_ZONE,
): string {
  if (isTimeZone(value)) return value;
  return isTimeZone(fallback) ? fallback : DEFAULT_TIME_ZONE;
}
