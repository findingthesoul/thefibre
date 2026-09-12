import { describe, expect, it } from 'vitest';
import { freeMinutes, isBusy, safeTimeZone, workingIntervals, zonedInstant } from './free-time.js';

const AMS = 'Europe/Amsterdam';
/** An Amsterdam wall-clock time as a Date. */
const ams = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(zonedInstant(y, m, d, h, AMS) + min * 60_000);
const meeting = (start: Date, end: Date, extra: Partial<{ allDay: boolean; transparent: boolean; declined: boolean }> = {}) => ({
  start,
  end,
  allDay: false,
  transparent: false,
  declined: false,
  ...extra,
});

// Wednesday 16 September 2026, a normal working day.
const WED = [2026, 9, 16] as const;

describe('working hours in the person\'s own timezone', () => {
  it('puts nine o\'clock in Amsterdam at seven UTC in summer', () => {
    expect(new Date(zonedInstant(...WED, 9, AMS)).toISOString()).toBe('2026-09-16T07:00:00.000Z');
  });

  it('puts nine o\'clock in Amsterdam at eight UTC in winter', () => {
    // The twin: the offset changes, the wall clock does not.
    expect(new Date(zonedInstant(2026, 12, 2, 9, AMS)).toISOString()).toBe('2026-12-02T08:00:00.000Z');
  });

  it('finds an hour that sits between the guess and the answer on a clock change', () => {
    // 01:00 on 25 October is still summer time (+2), so it is 23:00 UTC the
    // day before. A single pass reads the offset at 01:00 UTC, already winter
    // time, and lands an hour late. Day starts are computed at hour 0, so this
    // is the case a DST night actually hits.
    expect(new Date(zonedInstant(2026, 10, 25, 1, AMS)).toISOString()).toBe('2026-10-24T23:00:00.000Z');
  });

  it('keeps nine to five on the day the clocks go back', () => {
    // Sunday 25 October 2026 is not a workday; Monday 26th is the first
    // workday in winter time and must still be eight hours.
    const iv = workingIntervals(ams(2026, 10, 25, 0), ams(2026, 10, 27, 0), AMS);
    expect(iv).toHaveLength(1);
    expect((iv[0]!.end - iv[0]!.start) / 3_600_000).toBe(8);
    expect(new Date(iv[0]!.start).toISOString()).toBe('2026-10-26T08:00:00.000Z');
  });

  it('skips the weekend', () => {
    // Saturday 19 and Sunday 20 September.
    expect(workingIntervals(ams(2026, 9, 19, 0), ams(2026, 9, 21, 0), AMS)).toEqual([]);
  });

  it('counts only what is left of today', () => {
    // At 15:00 on a Wednesday, two working hours remain.
    expect(freeMinutes(ams(...WED, 15), ams(2026, 9, 17, 0), [], AMS)).toBe(120);
  });
});

describe('free time is working time minus meetings', () => {
  const day = [ams(...WED, 0), ams(2026, 9, 17, 0)] as const;

  it('gives a whole empty day as eight hours', () => {
    expect(freeMinutes(...day, [], AMS)).toBe(480);
  });

  it('subtracts a meeting', () => {
    expect(freeMinutes(...day, [meeting(ams(...WED, 10), ams(...WED, 11, 30))], AMS)).toBe(390);
  });

  it('counts overlapping meetings once', () => {
    const entries = [
      meeting(ams(...WED, 10), ams(...WED, 12)),
      meeting(ams(...WED, 11), ams(...WED, 13)),
    ];
    expect(freeMinutes(...day, entries, AMS)).toBe(300);
  });

  it('only counts the part of a meeting inside working hours', () => {
    // An 08:00–10:00 breakfast costs one working hour.
    expect(freeMinutes(...day, [meeting(ams(...WED, 8), ams(...WED, 10))], AMS)).toBe(420);
  });

  it('does not count an all-day entry, a declined meeting or one marked free', () => {
    const entries = [
      meeting(ams(...WED, 0), ams(2026, 9, 17, 0), { allDay: true }),
      meeting(ams(...WED, 10), ams(...WED, 11), { declined: true }),
      meeting(ams(...WED, 13), ams(...WED, 14), { transparent: true }),
    ];
    expect(freeMinutes(...day, entries, AMS)).toBe(480);
  });

  it('does count an ordinary meeting at the same hour', () => {
    // The twin of the exclusions above.
    expect(isBusy(meeting(ams(...WED, 10), ams(...WED, 11)))).toBe(true);
  });
});

it('falls back from a timezone Intl does not know', () => {
  expect(safeTimeZone('Mars/Olympus')).toBe('Europe/Amsterdam');
  expect(safeTimeZone('America/New_York')).toBe('America/New_York');
});
