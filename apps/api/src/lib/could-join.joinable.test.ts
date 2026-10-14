import { describe, expect, it } from 'vitest';
import { stillJoinable } from './could-join.js';

// ---------------------------------------------------------------------------
// A YEAR-LONG THREAD THAT OPENED YESTERDAY.
//
// The walk used to drop anything whose START was in the past. That is right
// for a one-day workshop and wrong for the shape soul.com actually sells:
// "Community agenda 2026" opened on 1 October 2026 and runs to the end of the
// year, so from 2 October it was absent from "what you can join" — while
// being, in life, the main thing the membership was for.
//
// Found on production on 2026-10-14 while working out why the card was empty
// for Sjoerd. He decided the rule the same day: the END date decides when
// there is one, and only a thread with no end falls back to its start.
//
// `today` is passed in everywhere, so these pass in Amsterdam and in UTC CI
// alike.
// ---------------------------------------------------------------------------

const TODAY = '2026-10-14';

describe('a thread with an end date', () => {
  it('is joinable after it has started — the case that was wrong', () => {
    // Opened yesterday, runs to the end of the year.
    expect(stillJoinable({ starts_on: '2026-10-13', ends_on: '2026-12-31' }, TODAY)).toBe(true);
    // The real row: "Community agenda 2026", open since 1 October.
    expect(stillJoinable({ starts_on: '2026-10-01', ends_on: '2026-12-31' }, TODAY)).toBe(true);
  });

  it('is joinable on its last day, and not the day after', () => {
    expect(stillJoinable({ starts_on: '2026-01-01', ends_on: TODAY }, TODAY)).toBe(true);
    expect(stillJoinable({ starts_on: '2026-01-01', ends_on: '2026-10-13' }, TODAY)).toBe(false);
  });

  it('is joinable before it starts', () => {
    expect(stillJoinable({ starts_on: '2027-01-01', ends_on: '2027-12-31' }, TODAY)).toBe(true);
  });

  it('ignores the start date entirely — the end is what decides', () => {
    // A thread whose dates make no sense should not become unjoinable for
    // that reason; the organiser's end date is still the promise.
    expect(stillJoinable({ starts_on: '2027-06-01', ends_on: '2026-10-13' }, TODAY)).toBe(false);
  });
});

describe('a thread with no end date', () => {
  it('falls back to its start — this is the old rule, kept', () => {
    expect(stillJoinable({ starts_on: '2026-10-15', ends_on: null }, TODAY)).toBe(true);
    expect(stillJoinable({ starts_on: TODAY, ends_on: null }, TODAY)).toBe(true);
    expect(stillJoinable({ starts_on: '2026-10-13', ends_on: null }, TODAY)).toBe(false);
  });
});

describe('a thread with no dates at all', () => {
  it('is joinable, because it has made no claim about when it happens', () => {
    for (const p of [
      { starts_on: null, ends_on: null },
      {},
      { starts_on: undefined, ends_on: undefined },
    ]) {
      expect(stillJoinable(p, TODAY), JSON.stringify(p)).toBe(true);
    }
  });
});
