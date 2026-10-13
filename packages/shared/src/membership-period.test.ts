// The panel and the invoice must name the same day.
//
// They did not: the join panel promised "runs to 31 December 2026 and renews
// on 1 January 2027" while the invoice for that same payment said "(until
// 2027-01-01)". Both describe one period — one by its last day, one by its
// renewal — and both on one purchase is what makes it a problem.

import { describe, expect, it } from 'vitest';
import { periodLastDay } from './membership-period.js';
import { fixedFirstPeriod } from './fixed-renewal.js';

describe('periodLastDay', () => {
  it('turns a renewal moment into the day before it', () => {
    expect(periodLastDay('2027-01-01T00:00:00Z')).toBe('2026-12-31');
    expect(periodLastDay('2027-10-13T11:16:19Z')).toBe('2027-10-12');
  });

  // The month boundary is where this is always needed, and where "subtract
  // one from the date part" would produce 2027-01-00.
  it('crosses a month and a year boundary properly', () => {
    expect(periodLastDay('2026-03-01T00:00:00Z')).toBe('2026-02-28');
    expect(periodLastDay('2028-03-01T00:00:00Z')).toBe('2028-02-29'); // a leap year
    expect(periodLastDay('2027-01-01T00:00:00Z')).toBe('2026-12-31');
  });

  it('reads Stripe’s seconds, an ISO string and a Date alike', () => {
    const renewal = Date.parse('2027-01-01T00:00:00Z');
    expect(periodLastDay(renewal / 1000)).toBe('2026-12-31');
    expect(periodLastDay(new Date(renewal))).toBe('2026-12-31');
    expect(periodLastDay('2027-01-01T00:00:00.000Z')).toBe('2026-12-31');
  });

  it('answers nothing rather than a wrong date', () => {
    for (const bad of [null, undefined, '', 'next year', Number.NaN]) {
      expect(periodLastDay(bad as never), String(bad)).toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE ONE THAT MATTERS: the two halves agree.
// ─────────────────────────────────────────────────────────────────────────────
describe('the panel sentence and the invoice label name the same day', () => {
  it('for a cohort tier', () => {
    // What the PANEL says, from the rule the charge runs.
    const period = fixedFirstPeriod('2026-12-31', new Date('2026-10-13T12:00:00Z'))!;
    expect(period.endsOn).toBe('2026-12-31');

    // What the INVOICE says: Stripe's period.end for that subscription is the
    // anchor — the renewal moment — and the label is the day before it.
    expect(periodLastDay(period.anchor)).toBe(period.endsOn);
  });

  it('and for an ordinary yearly join, which has the same day-off', () => {
    // No cohort date: the period ends a year after joining, and `period.end`
    // is again the renewal moment.
    const renewal = Date.parse('2027-10-13T11:16:19Z') / 1000;
    expect(periodLastDay(renewal)).toBe('2027-10-12');
  });
});
