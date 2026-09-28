import { describe, expect, it } from 'vitest';
import { spreadAcrossDays } from './spread-slots.js';

const AMS = 'Europe/Amsterdam';
/** Local Amsterdam wall time, as the instant it actually is. */
const at = (day: number, hour: number) =>
  new Date(Date.UTC(2026, 9, day, hour - 2, 0)); // CEST is UTC+2 in October 2026

describe('spreadAcrossDays', () => {
  it('takes one per day before taking two from any day', () => {
    // Four free slots on Monday, one on Tuesday, one on Wednesday. The naive
    // "first three" answer is three Monday slots — the thing a poll must not
    // offer, because it asks people to choose between 09:00, 10:00 and 11:00.
    const slots = [at(5, 9), at(5, 10), at(5, 11), at(5, 12), at(6, 14), at(7, 16)];
    const picked = spreadAcrossDays(slots, 3, AMS);
    expect(picked).toEqual([at(5, 9), at(6, 14), at(7, 16)]);
  });

  it('comes back for a second slot on a day, far from the first', () => {
    // Two days, three wanted. The second Monday pick should be the evening
    // one, not 10:00 — a morning and an afternoon are a real choice.
    const slots = [at(5, 9), at(5, 10), at(5, 17), at(6, 11)];
    const picked = spreadAcrossDays(slots, 3, AMS);
    expect(picked).toEqual([at(5, 9), at(5, 17), at(6, 11)]);
  });

  it('returns everything, in order, when there is not enough to choose from', () => {
    const slots = [at(6, 11), at(5, 9)];
    expect(spreadAcrossDays(slots, 5, AMS)).toEqual([at(5, 9), at(6, 11)]);
    expect(spreadAcrossDays([], 3, AMS)).toEqual([]);
  });

  it('answers in chronological order whatever order it picked in', () => {
    const slots = [at(7, 16), at(5, 9), at(6, 14), at(5, 11)];
    const picked = spreadAcrossDays(slots, 3, AMS);
    expect(picked).toEqual([...picked].sort((a, b) => +a - +b));
  });

  it('groups days in the HOST zone, not UTC', () => {
    // 00:30 Amsterdam on the 6th is 22:30 UTC on the 5th. Grouped in UTC these
    // two are one day and the second pick would be wrongly rejected as a
    // same-day repeat; in Amsterdam they are Monday and Tuesday.
    const lateMonday = new Date(Date.UTC(2026, 9, 5, 21, 0)); // 23:00 Mon AMS
    const earlyTuesday = new Date(Date.UTC(2026, 9, 5, 22, 30)); // 00:30 Tue AMS
    const picked = spreadAcrossDays([lateMonday, earlyTuesday, at(5, 9)], 2, AMS);
    // Two different Amsterdam days, earliest of each.
    expect(picked).toEqual([at(5, 9), earlyTuesday]);
  });

  it('never returns more than asked', () => {
    const many = Array.from({ length: 40 }, (_, i) => at(5 + (i % 10), 9 + (i % 6)));
    expect(spreadAcrossDays(many, 5, AMS)).toHaveLength(5);
    expect(spreadAcrossDays(many, 2, AMS)).toHaveLength(2);
  });
});
