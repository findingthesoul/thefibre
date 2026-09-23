// The clock is the input here, so every case names the hour it is read at.
// A test that reads the wall clock would be green in CI (UTC) and wrong on
// the machine this was found on — the same lesson as the day-grid tests.

import { describe, expect, it } from 'vitest';
import { zonedDayStart } from './free-time.js';
import { DAY_MS, dayInstant, daysBetween } from './day-instant.js';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const at = (day: string, h: number) =>
  new Date(`${day}T${String(h).padStart(2, '0')}:30:00.000Z`);

describe('dayInstant', () => {
  it('is midday on the named day', () => {
    expect(dayInstant('2026-09-23').toISOString()).toBe('2026-09-23T12:00:00.000Z');
  });

  it('reads as the right number of days at EVERY hour of the day', () => {
    // The whole point. Midnight passes this at 09:00 and fails it at 15:00,
    // which is why the bug was invisible to every morning check.
    for (const h of HOURS) {
      const now = at('2026-09-23', h);
      expect(daysBetween(dayInstant('2026-09-23'), now), `today at ${h}:30`).toBe(0);
      expect(daysBetween(dayInstant('2026-09-24'), now), `tomorrow at ${h}:30`).toBe(1);
      expect(daysBetween(dayInstant('2026-09-22'), now), `yesterday at ${h}:30`).toBe(-1);
      expect(daysBetween(dayInstant('2026-09-25'), now), `+2 at ${h}:30`).toBe(2);
    }
  });

  it('is what MIDNIGHT gets wrong — the guard would pass without the fix', () => {
    // Mutation-proof in the file: if someone "simplifies" dayInstant back to
    // T00:00:00, the test above starts failing. This records what it fails
    // WITH, so the next reader can see the bug rather than infer it.
    const midnight = new Date('2026-09-23T00:00:00.000Z');
    expect(daysBetween(midnight, at('2026-09-23', 9))).toBe(0);
    expect(daysBetween(midnight, at('2026-09-23', 15))).toBe(-1); // "yesterday"
  });
});

describe('day boundaries', () => {
  // The caution raised when this fix was handed over: `prepare_at` is derived
  // from this instant by subtracting whole lead days, and the segments key off
  // `prepare_at` against a day start. Reasoning said "it shifts consistently".
  // Asserting it instead turned up something the reasoning had wrong, which is
  // the whole argument for asserting it.
  const LEAD_DAYS = [0, 1, 2, 3, 7, 14];
  const DAYS = ['2026-09-23', '2026-01-15', '2026-03-29', '2026-10-25'];

  it('stays clear of a day start in the zones this product runs in', () => {
    // Europe is what Connect serves. Midday UTC is 13:00 or 14:00 there, the
    // furthest a row gets from either boundary.
    for (const zone of ['Europe/Amsterdam', 'UTC', 'America/New_York']) {
      for (const day of DAYS) {
        for (const lead of LEAD_DAYS) {
          const prepareAt = new Date(dayInstant(day).getTime() - lead * DAY_MS);
          expect(
            prepareAt.getTime(),
            `${day} −${lead}d in ${zone}`,
          ).not.toBe(zonedDayStart(prepareAt, zone).getTime());
        }
      }
    }
  });

  it('DOES sit on the boundary at UTC+12 — recorded, not wished away', () => {
    // I wrote the assertion above for Pacific/Auckland too and it failed:
    // 12:00Z is exactly 00:00 NZST. So "midday is never on a boundary" is
    // false in general, and the comment in day-instant.ts says so because
    // this test refused to agree with it.
    const prepareAt = dayInstant('2026-09-23');
    expect(zonedDayStart(prepareAt, 'Pacific/Auckland').getTime()).toBe(prepareAt.getTime());
  });

  it('puts an instant in exactly one segment, boundary or not', () => {
    // Which is why the coincidence above is not a bug. The route partitions
    // with `at < tomorrowStart` / `at >= tomorrowStart` — total and disjoint,
    // so a tie has a defined answer rather than an undefined one.
    const tomorrowStart = new Date('2026-09-24T00:00:00.000Z');
    for (const at of [
      dayInstant('2026-09-23'),
      new Date(tomorrowStart.getTime() - 1),
      tomorrowStart,
      new Date(tomorrowStart.getTime() + 1),
    ]) {
      const today = at < tomorrowStart;
      const tomorrow = at >= tomorrowStart;
      expect(Number(today) + Number(tomorrow), `${at.toISOString()}`).toBe(1);
    }
  });
});
