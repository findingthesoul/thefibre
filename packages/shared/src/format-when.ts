// Saying when something is, in a named zone.
//
// This exists because the same mistake has now been made twice, in two
// renderers, with the same symptom and a two-hour error:
//
//   2026-09-23  Meet's confirmation page: `toLocaleString(undefined, …)`
//               server-side means the SERVER's zone, UTC on the host, so a
//               booking made for 09:00 Amsterdam read 07:00.
//   2026-10-01  Meet's CANCEL page: `toLocaleString(locale, …)` with no
//               `timeZone` at all — same thing, same two hours, on the one
//               screen whose whole job is making somebody certain before they
//               cancel.
//
// The fix both times is the same two decisions, so they live here rather than
// in each page: pass a zone EXPLICITLY, and name it in the output. A time
// without a zone is not a smaller truth, it is an ambiguous one — "15:00" is
// the thing that started this.
//
// Pure, and the zone is an argument, so it is testable without a DOM and
// behaves identically on a server and in a browser.

/** A full, human date and time — "Tuesday, 13 October 2026 at 11:00 CEST". */
export function formatWhenInZone(
  iso: string | Date,
  timeZone: string,
  /** An Intl locale tag, e.g. from INTL_LOCALES. */
  intlLocale: string,
): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(intlLocale, {
      timeZone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(d);
  } catch {
    // An unknown zone must not take the page down. Fall back to UTC and SAY
    // UTC — wrong-but-labelled is recoverable by a reader; wrong-and-silent
    // is what this module exists to stop.
    return new Intl.DateTimeFormat(intlLocale, {
      timeZone: 'UTC',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(d);
  }
}
