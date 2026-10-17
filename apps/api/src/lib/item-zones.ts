// The time zone each portal item is read in (additive `timezone` fields on
// Meet bookings, notifications and a community's "next", 2026-10-17).
//
// Without one, my.thread formats those times in its default Europe/Amsterdam,
// so a thread run in Lisbon or a booking made from New York showed the wrong
// clock. Every value here is validated with isTimeZone before it leaves: a
// stored zone is free text (see 20261007200836), and on 2026-09-28 one bad
// value ('Athenes') took down every signed-in page. An unknown zone is sent
// as null — the client then keeps its default, exactly as before.

import { isTimeZone } from '@thefibre/shared';
import { adminClient } from '../db.js';
import { rows } from './rows.js';

/** A stored zone, or null when it is missing or not a real IANA name. */
export function zoneOrNull(v: unknown): string | null {
  return typeof v === 'string' && v && isTimeZone(v) ? v : null;
}

/** A Meet booking, as its GUEST reads it: the zone they booked in (recorded
 *  since 2026-10-07), else the host's — the zone the booking was offered in. */
export function bookingZone(b: { invitee_timezone?: unknown; host_timezone?: unknown }): string | null {
  return zoneOrNull(b.invitee_timezone) ?? zoneOrNull(b.host_timezone);
}

/** thread id → that thread's own zone, for the ids given (one query). */
export async function threadZones(threadIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const ids = [...new Set(threadIds.filter((t): t is string => !!t))];
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const list = rows(
    'item-zones: threads',
    await adminClient.from('thread_thread').select('id, timezone').in('id', ids),
  ) as { id: string; timezone: string | null }[];
  for (const t of list) {
    const z = zoneOrNull(t.timezone);
    if (z) out.set(t.id, z);
  }
  return out;
}
