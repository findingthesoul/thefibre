// What the join panel promises must be what the charge does.
//
// The sentence above the Pay button is the last thing somebody reads before
// money moves, so the cases that matter are the ones where the panel could
// say one thing and Stripe do another: a launch-cohort tier joined in
// October, the same tier joined monthly, and the same tier after its date has
// passed. Each takes the clock as an argument — a rule about dates that reads
// the wall clock passes in UTC CI in October and fails for a real person in
// December.

import { describe, expect, it } from 'vitest';
import { payLineFor } from './pay-line';

const at = (iso: string) => new Date(iso);
const END = '2026-12-31';

describe('which sentence the join panel says', () => {
  it('says nothing when there is no price to state', () => {
    // A tier priced "on request". Saying nothing is right; inventing a zero
    // and announcing "You pay € 0 now" is not.
    expect(payLineFor({ amountCents: null, interval: 'year', now: at('2026-10-13T12:00:00Z') })).toEqual({
      kind: 'none',
    });
  });

  it('says the ordinary yearly thing when the tier has no fixed date', () => {
    expect(
      payLineFor({ amountCents: 30000, interval: 'year', now: at('2026-10-13T12:00:00Z') }),
    ).toEqual({ kind: 'recurring', interval: 'year', discounted: false });
  });

  it('says the ordinary monthly thing for a monthly join', () => {
    expect(
      payLineFor({ amountCents: 3600, interval: 'month', now: at('2026-10-13T12:00:00Z') }),
    ).toEqual({ kind: 'recurring', interval: 'month', discounted: false });
  });

  // THE case this file exists for. Somebody joining in October under the
  // launch cohort pays the whole year and renews on 1 January — and that was
  // visible nowhere until the charge had happened.
  it('names both dates for a launch-cohort join, and the renewal is the day after', () => {
    const line = payLineFor({
      amountCents: 30000,
      interval: 'year',
      firstPeriodEndsOn: END,
      now: at('2026-10-13T12:00:00Z'),
    });
    expect(line).toEqual({ kind: 'fixed', discounted: false, endsOn: '2026-12-31', renewsOn: '2027-01-01' });
  });

  // A MONTHLY join must not be told the cohort's story: the rule does not
  // apply to it, and saying "runs to 31 December" over a €36 charge would be
  // a promise of ten free weeks.
  it('does not tell a monthly join the cohort’s story', () => {
    expect(
      payLineFor({
        amountCents: 3600,
        interval: 'month',
        firstPeriodEndsOn: END,
        now: at('2026-10-13T12:00:00Z'),
      }),
    ).toEqual({ kind: 'recurring', interval: 'month', discounted: false });
  });

  // Self-expiring, which is the point of the whole design: the setting needs
  // no cleanup after the launch it was made for, and the panel must follow it
  // into retirement rather than keep promising a date in the past.
  it('says the ordinary thing once the fixed date has gone by', () => {
    expect(
      payLineFor({
        amountCents: 30000,
        interval: 'year',
        firstPeriodEndsOn: END,
        now: at('2027-02-01T12:00:00Z'),
      }),
    ).toEqual({ kind: 'recurring', interval: 'year', discounted: false });
  });

  // Stripe will not accept an anchor less than 48 hours out, so the charge
  // falls back to an ordinary subscription — and the sentence has to fall
  // back with it. This is the case where a second copy of the rule would
  // quietly lie: joining on 30 December under a 31 December cohort.
  it('follows the charge through Stripe’s 48-hour floor', () => {
    expect(
      payLineFor({
        amountCents: 30000,
        interval: 'year',
        firstPeriodEndsOn: END,
        now: at('2026-12-31T12:00:00Z'),
      }),
    ).toEqual({ kind: 'recurring', interval: 'year', discounted: false });
    // And still names the dates a comfortable distance out.
    expect(
      payLineFor({
        amountCents: 30000,
        interval: 'year',
        firstPeriodEndsOn: END,
        now: at('2026-12-20T12:00:00Z'),
      }),
    ).toMatchObject({ kind: 'fixed' });
  });

  it('ignores a date that is not one', () => {
    for (const bad of ['2026-02-31', 'next year', '', null, undefined]) {
      expect(
        payLineFor({
          amountCents: 30000,
          interval: 'year',
          firstPeriodEndsOn: bad,
          now: at('2026-10-13T12:00:00Z'),
        }),
        `${JSON.stringify(bad)} is not a date`,
      ).toEqual({ kind: 'recurring', interval: 'year', discounted: false });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A DISCOUNT CODE applies to the first period only (decided 2026-10-13), so
// the sentence has to name two numbers. Somebody told only "€150" will
// believe that is what a membership costs, and will find out a year later.
// ─────────────────────────────────────────────────────────────────────────────
describe('when a code has changed the price', () => {
  it('says so, so the renewal price can be named', () => {
    expect(
      payLineFor({
        amountCents: 15000,
        fullAmountCents: 30000,
        interval: 'year',
        now: at('2026-10-13T12:00:00Z'),
      }),
    ).toEqual({ kind: 'recurring', interval: 'year', discounted: true });
  });

  it('carries into a cohort join, where both dates and both prices matter', () => {
    expect(
      payLineFor({
        amountCents: 15000,
        fullAmountCents: 30000,
        interval: 'year',
        firstPeriodEndsOn: END,
        now: at('2026-10-13T12:00:00Z'),
      }),
    ).toEqual({ kind: 'fixed', discounted: true, endsOn: '2026-12-31', renewsOn: '2027-01-01' });
  });

  // A code that does not move the number must not make the sentence promise a
  // different renewal from the thing being paid — which is what a 0% code, or
  // one whose discount rounds to nothing, would otherwise do.
  it('is not "discounted" when the two numbers are the same', () => {
    expect(
      payLineFor({
        amountCents: 30000,
        fullAmountCents: 30000,
        interval: 'year',
        now: at('2026-10-13T12:00:00Z'),
      }),
    ).toEqual({ kind: 'recurring', interval: 'year', discounted: false });
  });

  it('is not "discounted" when no full price was given at all', () => {
    for (const full of [null, undefined]) {
      expect(
        payLineFor({
          amountCents: 30000,
          fullAmountCents: full,
          interval: 'year',
          now: at('2026-10-13T12:00:00Z'),
        }),
        String(full),
      ).toEqual({ kind: 'recurring', interval: 'year', discounted: false });
    }
  });

  // A 100% code: free now, full price later. The sentence must still name the
  // renewal — this is the case where saying only the first number is worst.
  it('names the renewal for a free first period', () => {
    expect(
      payLineFor({
        amountCents: 0,
        fullAmountCents: 30000,
        interval: 'year',
        now: at('2026-10-13T12:00:00Z'),
      }),
    ).toEqual({ kind: 'recurring', interval: 'year', discounted: true });
  });
});
