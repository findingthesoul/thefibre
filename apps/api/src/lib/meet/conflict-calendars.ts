// Which of a host's calendars count as a conflict.
//
// The rule used to exist twice, in two different shapes, and the two
// disagreed — the slot list honoured the meeting type's own choice of
// calendars and the availability check ignored it. A time was offered and
// then refused, and the invitee was told the slot had just gone (reported
// 2026-10-06 on staging, and live on three production meeting types).
//
// So the rule is here, as data in and data out, with no database in sight:
// the two callers fetch the same rows and both ask this.

export type CalendarRow = {
  id: string;
  host_id: string;
  google_calendar_id: string | null;
  role: string | null;
};

/** The roles that conflict-check by default. `ignore` is excluded, and
 *  `write_target` is deliberately NOT here: it would silently shrink the
 *  times every host is offered, and no row anywhere has that role today. */
const DEFAULT_ROLES = ['primary', 'conflict_check'];

/**
 * The Google calendar ids to conflict-check for one host.
 *
 * - The meeting type NAMED calendars (by `meet_calendar.id`) → use the ones
 *   that belong to this host, whatever their role. Naming a calendar is the
 *   decision, including naming one otherwise marked `ignore`.
 * - It named none → this host's `primary` and `conflict_check` calendars.
 *
 * Per host, which matters on a team meeting type: the named ids belong to the
 * meeting type's OWNER, so another host on that team matches none of them and
 * falls back to their own roles. Matching by id alone would have left those
 * hosts with no conflict checking at all — i.e. bookable over anything.
 */
export function conflictCalendarIdsFor(
  hostId: string,
  rows: readonly CalendarRow[],
  namedCalendarIds: readonly string[] | null | undefined,
): string[] {
  const named = new Set(namedCalendarIds ?? []);
  const mine = rows.filter((r) => r.host_id === hostId && r.google_calendar_id);
  const chosen = mine.filter((r) => named.has(r.id));
  const use = chosen.length > 0 ? chosen : mine.filter((r) => DEFAULT_ROLES.includes(r.role ?? ''));
  // De-duplicated: two rows may point at the same Google calendar, and asking
  // freebusy about it twice would be harmless but wasteful.
  return [...new Set(use.map((r) => r.google_calendar_id as string))];
}
