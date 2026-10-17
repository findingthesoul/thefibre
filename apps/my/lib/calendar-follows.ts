// Does this person's calendar follow the feed — closely enough that the
// calendar window (apps/api/src/lib/calendar-window.ts) skips their
// invitations? The SAME rule, so the card never promises what the window
// does not do: a live address (not revoked — `subscribed`) that a calendar
// has read within FEED_ACTIVE_DAYS, inclusive at the edge as the window's
// `.gte` is.
//
// `now` is an argument so the test pins the clock.

import type { CalendarStatus } from './portal-api';

/** Mirrors FEED_ACTIVE_DAYS in apps/api/src/lib/calendar-window.ts. */
export const FEED_ACTIVE_DAYS = 14;
const DAY = 86_400_000;

export function feedIsFollowed(status: Pick<CalendarStatus, 'subscribed' | 'last_read_at'>, now: Date): boolean {
  if (!status.subscribed || !status.last_read_at) return false;
  const read = new Date(status.last_read_at).getTime();
  if (!Number.isFinite(read)) return false;
  return read >= now.getTime() - FEED_ACTIVE_DAYS * DAY;
}
