// The agenda's window, which two endpoints have to agree on.
//
// Sjoerd, 2026-09-23, on a meeting that had already finished: *"What does: no
// longer in your agenda means? I select them, but nothing happens"*. The list
// showed the whole day (what has passed is greyed out but still there), while
// the add endpoint searched from `new Date()`. So every attendee of a meeting
// earlier today was displayed with an add button that returned 404, and the
// row then said "no longer in your agenda" about a meeting that had simply
// already happened.
//
// Neither side errored. Each was correct alone. Only a test that they compute
// the SAME window catches it, which is why agendaWindow is one function and
// this file asserts what it means rather than what it returns.

import { describe, expect, it } from 'vitest';
import { agendaWindow } from './connections-agenda.js';

const TZ = 'Europe/Amsterdam';
/** Mid-afternoon, so "earlier today" is a real span. Pinned: read the clock
 *  here and this file is green in CI and red at 08:00. */
const NOW = new Date('2026-09-23T15:30:00.000Z');
const inWindow = (w: { from: Date; to: Date }, at: string) => {
  const t = new Date(at).getTime();
  return t >= w.from.getTime() && t < w.to.getTime();
};

describe('agendaWindow', () => {
  it('includes a meeting that already finished today', () => {
    const w = agendaWindow(NOW, TZ, 0, 2);
    // 09:00 UTC — over six hours before `now`, and the case that was broken.
    expect(inWindow(w, '2026-09-23T09:00:00.000Z')).toBe(true);
    // The old window started at `now`; this is what it got wrong.
    expect(w.from.getTime()).toBeLessThan(NOW.getTime());
  });

  it('starts at the local day start, not at midnight UTC', () => {
    const w = agendaWindow(NOW, TZ, 0, 2);
    // Amsterdam is UTC+2 in September, so the day begins at 22:00 the night
    // before, in UTC. A window built on UTC midnight would wrongly include
    // two hours of the previous evening.
    expect(w.from.toISOString()).toBe('2026-09-22T22:00:00.000Z');
  });

  it('covers today AND tomorrow at the default span, because Today shows both', () => {
    const w = agendaWindow(NOW, TZ, 0, 2);
    expect(inWindow(w, '2026-09-24T18:00:00.000Z')).toBe(true); // tomorrow evening
    expect(inWindow(w, '2026-09-25T09:00:00.000Z')).toBe(false); // the day after
  });

  it('shifts a whole day for the tomorrow view', () => {
    const w = agendaWindow(NOW, TZ, 1, 1);
    expect(w.from.toISOString()).toBe('2026-09-23T22:00:00.000Z');
    expect(inWindow(w, '2026-09-23T09:00:00.000Z')).toBe(false); // today is out
    expect(inWindow(w, '2026-09-24T09:00:00.000Z')).toBe(true);
  });

  it('without a timezone keeps the old from-now behaviour', () => {
    // A caller asking for "the next N hours" rather than a day.
    const w = agendaWindow(NOW, null, 0, 1);
    expect(w.from.getTime()).toBe(NOW.getTime());
  });

  it('survives the DST switch — the day start is still the day start', () => {
    // 25 Oct 2026 is the Amsterdam switch; the day is 25 hours long.
    const dstNow = new Date('2026-10-25T15:30:00.000Z');
    const w = agendaWindow(dstNow, TZ, 0, 2);
    expect(inWindow(w, '2026-10-25T09:00:00.000Z')).toBe(true);
    expect(w.from.getTime()).toBeLessThan(dstNow.getTime());
  });
});
