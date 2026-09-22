// The one piece of date arithmetic in the agenda that is easy to get wrong
// and impossible to notice: which instant "the start of today" is.
//
// The server's clock is UTC. In Amsterdam in summer that is two hours behind
// the viewer's day, so reading the calendar from the server's midnight drops
// the first two hours of a person's morning — and in the other direction, for
// somebody west of UTC, it picks up the tail of yesterday.

import { describe, expect, it } from 'vitest';
import { zonedDayStart } from './free-time.js';

/** What the instant reads as on a wall clock in `tz`. */
const wall = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);

/** The route's own "same clock time, n days later" — copied here rather than
 *  exported, because what is under test is the RULE (a DST day must not move
 *  tomorrow's start) and a copy that drifts from the route would show up as
 *  this test passing while the route is wrong. Kept identical on purpose;
 *  connections-agenda.ts carries the same comment. */
const offsetDays = (from: Date, n: number, tz: string) =>
  n === 0 ? from : new Date(zonedDayStart(from, tz).getTime() + n * 86_400_000 + 12 * 3_600_000);

describe('tomorrow, across a clock change', () => {
  it('starts at midnight the next day when the clocks go back', () => {
    // 25 October 2026 is the day before Europe's autumn change; the 26th has
    // 25 hours. Naive +24h from the 25th's midnight lands at 23:00 on the
    // 25th, which would draw yesterday.
    const start = zonedDayStart(offsetDays(new Date('2026-10-25T09:00:00Z'), 1, 'Europe/Amsterdam'), 'Europe/Amsterdam');
    expect(wall(start, 'Europe/Amsterdam')).toBe('26/10/2026, 00:00');
  });

  it('starts at midnight the next day when the clocks go forward', () => {
    // 29 March 2026 has 23 hours.
    const start = zonedDayStart(offsetDays(new Date('2026-03-28T09:00:00Z'), 1, 'Europe/Amsterdam'), 'Europe/Amsterdam');
    expect(wall(start, 'Europe/Amsterdam')).toBe('29/03/2026, 00:00');
  });

  it('is today when the offset is zero', () => {
    const at = new Date('2026-09-22T09:00:00Z');
    expect(offsetDays(at, 0, 'Europe/Amsterdam')).toBe(at);
  });
});

describe('the start of the viewer’s day', () => {
  it('is midnight where they are, not where the server is', () => {
    // 00:30 UTC on 21 September is already 02:30 in Amsterdam — the same day
    // there, so the day started at 00:00 Amsterdam, which is 22:00 UTC on
    // the 20th.
    const at = new Date('2026-09-21T00:30:00Z');
    const start = zonedDayStart(at, 'Europe/Amsterdam');
    expect(wall(start, 'Europe/Amsterdam')).toBe('21/09/2026, 00:00');
    expect(start.toISOString()).toBe('2026-09-20T22:00:00.000Z');
  });

  it('gives yesterday for somebody west of UTC whose day has not turned', () => {
    // 02:00 UTC is still 22:00 the previous evening in New York.
    const at = new Date('2026-09-21T02:00:00Z');
    const start = zonedDayStart(at, 'America/New_York');
    expect(wall(start, 'America/New_York')).toBe('20/09/2026, 00:00');
  });

  it('survives the clocks going back, when one wall time happens twice', () => {
    // 26 October 2026, the European autumn change. Whatever the offset does
    // during the day, the day still starts at 00:00 local.
    const at = new Date('2026-10-26T12:00:00Z');
    const start = zonedDayStart(at, 'Europe/Amsterdam');
    expect(wall(start, 'Europe/Amsterdam')).toBe('26/10/2026, 00:00');
  });

  it('is never later than the moment it was asked about', () => {
    for (const iso of ['2026-01-01T00:00:00Z', '2026-06-15T23:59:00Z', '2026-03-29T01:30:00Z']) {
      const at = new Date(iso);
      expect(zonedDayStart(at, 'Europe/Amsterdam').getTime()).toBeLessThanOrEqual(at.getTime());
    }
  });
});
