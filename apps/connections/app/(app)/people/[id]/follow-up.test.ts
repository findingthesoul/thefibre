// When a follow-up choice is due.
//
// Sjoerd, 2026-09-14, asked for today, tomorrow and this week. The short
// horizons are where the edges are — a late evening, a Friday afternoon, a
// weekend — so those are what is pinned here, against a fixed clock.

import { describe, expect, it } from 'vitest';
import { followUpIso } from './notes';

/** Local time, so the assertions read the way a person would say them. */
const local = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);
const due = (choice: Parameters<typeof followUpIso>[0], now: Date) =>
  new Date(followUpIso(choice, '', now)!);

describe('today', () => {
  it('is the end of the working day', () => {
    const d = due('today', local(2026, 9, 14, 10));
    expect([d.getHours(), d.getDate()]).toEqual([17, 14]);
  });

  it('is right now when the working day is already over — never in the past', () => {
    const now = local(2026, 9, 14, 21, 30);
    expect(due('today', now).getTime()).toBe(now.getTime());
  });
});

describe('tomorrow', () => {
  it('is nine in the morning the next day', () => {
    const d = due('tomorrow', local(2026, 9, 14, 23));
    expect([d.getDate(), d.getHours()]).toEqual([15, 9]);
  });

  it('crosses a month end', () => {
    const d = due('tomorrow', local(2026, 9, 30, 12));
    expect([d.getMonth() + 1, d.getDate()]).toEqual([10, 1]);
  });
});

describe('this week', () => {
  it('is Friday at the end of the day, from a Monday', () => {
    // 2026-09-14 is a Monday.
    const d = due('this_week', local(2026, 9, 14, 10));
    expect([d.getDay(), d.getDate(), d.getHours()]).toEqual([5, 18, 17]);
  });

  it('is later today on a Friday morning', () => {
    const d = due('this_week', local(2026, 9, 18, 9));
    expect([d.getDate(), d.getHours()]).toEqual([18, 17]);
  });

  it('is right now on a Saturday — the week has nowhere left to go', () => {
    const now = local(2026, 9, 19, 11);
    expect(due('this_week', now).getTime()).toBe(now.getTime());
  });

  it('is right now on a Sunday — not the Friday of the week after', () => {
    // The case the first implementation got most wrong: 0 <= 5, so Sunday
    // counted five days forward to NEXT week's Friday.
    const now = local(2026, 9, 20, 11);
    expect(due('this_week', now).getTime()).toBe(now.getTime());
  });

  it('is right now on a Friday evening, not a Friday already past', () => {
    const now = local(2026, 9, 18, 20);
    expect(due('this_week', now).getTime()).toBe(now.getTime());
  });
});

describe('nothing planned', () => {
  it('writes no follow-up at all', () => {
    expect(followUpIso('none', '', local(2026, 9, 14, 10))).toBeNull();
  });

  it('a picked date with nothing picked is not a follow-up', () => {
    expect(followUpIso('exact', '', local(2026, 9, 14, 10))).toBeNull();
  });
});
