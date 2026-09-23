import { describe, it, expect } from 'vitest';
import { busyFromEventItems } from './client.js';

// The rules behind Settings → Calendars: "Events marked Free still block".
// Google's own freebusy query answers a different question, so these are the
// exclusions we apply ourselves — each one is a way the setting could block
// more than anybody means.
describe('busyFromEventItems', () => {
  const timed = (start: string, end: string, extra = {}) => ({
    start: { dateTime: start },
    end: { dateTime: end },
    ...extra,
  });

  it('counts a timed event marked Free, which freebusy would omit', () => {
    const out = busyFromEventItems([
      timed('2026-09-24T09:00:00Z', '2026-09-24T11:00:00Z', { transparency: 'transparent' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.start.toISOString()).toBe('2026-09-24T09:00:00.000Z');
    expect(out[0]!.end.toISOString()).toBe('2026-09-24T11:00:00.000Z');
  });

  it('ignores an all-day event — it would close the whole day', () => {
    expect(
      busyFromEventItems([{ start: { date: '2026-09-24' }, end: { date: '2026-09-25' } }]),
    ).toEqual([]);
  });

  it('ignores a cancelled event', () => {
    expect(
      busyFromEventItems([
        timed('2026-09-24T09:00:00Z', '2026-09-24T10:00:00Z', { status: 'cancelled' }),
      ]),
    ).toEqual([]);
  });

  it('ignores a meeting this person declined, but not one somebody else declined', () => {
    const declinedByMe = timed('2026-09-24T09:00:00Z', '2026-09-24T10:00:00Z', {
      attendees: [{ self: true, responseStatus: 'declined' }],
    });
    const declinedByOther = timed('2026-09-24T14:00:00Z', '2026-09-24T15:00:00Z', {
      attendees: [{ responseStatus: 'declined' }, { self: true, responseStatus: 'accepted' }],
    });
    const out = busyFromEventItems([declinedByMe, declinedByOther]);
    expect(out).toHaveLength(1);
    expect(out[0]!.start.toISOString()).toBe('2026-09-24T14:00:00.000Z');
  });
});
