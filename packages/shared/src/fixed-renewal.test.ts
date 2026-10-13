// The launch cohort's billing rule, pinned.
//
// It is about dates, so the clock is a parameter in every case: a rule like
// this passes in UTC CI in October and fails for a real person in December.

import { describe, expect, it } from 'vitest';
import { fixedFirstPeriod } from './fixed-renewal.js';

const END = '2026-12-31';
const at = (iso: string) => new Date(iso);

// The route-wiring half of this file lives where the route does:
// apps/api/src/routes/fixed-renewal-wiring.test.ts. It reads membership.ts
// off disk, which only works inside that package.

describe('fixedFirstPeriod', () => {
  it('is off when the tier has no date', () => {
    expect(fixedFirstPeriod(null, at('2026-10-13T12:00:00Z'))).toBeNull();
    expect(fixedFirstPeriod(undefined, at('2026-10-13T12:00:00Z'))).toBeNull();
    expect(fixedFirstPeriod('', at('2026-10-13T12:00:00Z'))).toBeNull();
  });

  it('charges the full period now and renews the day AFTER the date', () => {
    const r = fixedFirstPeriod(END, at('2026-10-13T12:00:00Z'));
    expect(r, 'it applies').not.toBeNull();
    expect(r!.chargeFullNow).toBe(true);
    // "runs up 31/12/2026" means the next charge is 1 January, not 31
    // December — the period includes its last day.
    expect(new Date(r!.anchor * 1000).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('switches off inside 48 hours of the anchor, because Stripe refuses a shorter trial', () => {
    // Measured, not deduced. Checkout refuses proration_behavior 'none'
    // beside a one-time price, and without it Stripe adds a proration
    // (365.35 instead of 300.00). trial_end is the only shape that bills
    // 300.00 now and 300.00 on 1 January — and Stripe requires it to be at
    // least 48 hours ahead. So the last two days fall back to an ordinary
    // join rather than failing at the till.
    expect(fixedFirstPeriod(END, at('2026-12-30T12:00:00Z')), '36 hours before').toBeNull();
    expect(fixedFirstPeriod(END, at('2026-12-31T12:00:00Z')), '12 hours before').toBeNull();
    expect(
      fixedFirstPeriod(END, at('2026-12-29T12:00:00Z')),
      '60 hours before, still in',
    ).not.toBeNull();
  });

  it('applies right up to the 48-hour edge', () => {
    // trial_end could not serve this cohort at all: Stripe requires it to be
    // at least 48 hours ahead, and 30 Dec → 1 Jan is less. billing_cycle_anchor
    // has no such floor, which is why the rule returns an anchor and not a
    // trial.
    const r = fixedFirstPeriod(END, at('2026-12-29T12:00:00Z'));
    expect(r).not.toBeNull();
    expect(new Date(r!.anchor * 1000).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('does NOT apply during the last day any more, and that is a trade', () => {
    // It used to: the period being paid for had not ended. But the only
    // mechanism Checkout accepts needs 48 hours, so a 31 December joiner
    // bills the ordinary way and renews on 31 December. Charging them
    // normally is better than a failed checkout or a silent proration.
    expect(fixedFirstPeriod(END, at('2026-12-31T23:59:00Z'))).toBeNull();
  });

  it('switches itself off once the date has passed', () => {
    // The whole point of a one-time setting: no cleanup, no migration, no
    // admin remembering to untick it in January.
    expect(fixedFirstPeriod(END, at('2027-01-01T00:00:00Z')), 'at the anchor').toBeNull();
    expect(fixedFirstPeriod(END, at('2027-01-01T00:00:01Z')), 'after it').toBeNull();
    expect(fixedFirstPeriod(END, at('2027-06-01T00:00:00Z')), 'months later').toBeNull();
  });

  it('refuses anything that is not a plain date rather than guessing', () => {
    // Date.parse does this work; there is no separate shape check, because
    // mutating one away broke nothing. The cases are still pinned here.
    expect(fixedFirstPeriod('31-12-2026', at('2026-10-13T12:00:00Z'))).toBeNull();
    expect(fixedFirstPeriod('2026-12-31T00:00:00Z', at('2026-10-13T12:00:00Z'))).toBeNull();
    expect(fixedFirstPeriod('soon', at('2026-10-13T12:00:00Z'))).toBeNull();
  });

  it('refuses a day that does not exist, rather than rolling it over', () => {
    // 2026-02-31 parses — to 3 March. Both the shape check and Date.parse let
    // it through, so an admin's typo would have become an anchor in another
    // month without a word. Found by mutation: removing the shape check broke
    // nothing, which is how I learned it was not the check that mattered.
    expect(fixedFirstPeriod('2026-02-31', at('2026-01-05T12:00:00Z'))).toBeNull();
    expect(fixedFirstPeriod('2026-13-01', at('2026-01-05T12:00:00Z'))).toBeNull();
    // And a real leap day is accepted, so the guard is not just "February is
    // suspicious".
    expect(fixedFirstPeriod('2028-02-29', at('2028-01-05T12:00:00Z'))).not.toBeNull();
  });

  it('carries the date itself, for the sentence a person reads', () => {
    expect(fixedFirstPeriod(END, at('2026-10-13T12:00:00Z'))!.endsOn).toBe(END);
  });
});
