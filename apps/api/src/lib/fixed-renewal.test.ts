// The launch cohort's billing rule, pinned.
//
// It is about dates, so the clock is a parameter in every case: a rule like
// this passes in UTC CI in October and fails for a real person in December.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fixedFirstPeriod } from './fixed-renewal.js';

const END = '2026-12-31';
const at = (iso: string) => new Date(iso);

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

  it('still applies to a 30 December joiner — the case that chose the mechanism', () => {
    // trial_end could not serve this cohort at all: Stripe requires it to be
    // at least 48 hours ahead, and 30 Dec → 1 Jan is less. billing_cycle_anchor
    // has no such floor, which is why the rule returns an anchor and not a
    // trial.
    const r = fixedFirstPeriod(END, at('2026-12-30T09:00:00Z'));
    expect(r).not.toBeNull();
    expect(new Date(r!.anchor * 1000).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('applies DURING the last day, because that period has not ended', () => {
    const r = fixedFirstPeriod(END, at('2026-12-31T23:59:00Z'));
    expect(r, 'joining on the last day still belongs to the cohort').not.toBeNull();
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

// ─────────────────────────────────────────────────────────────────────────────
// The WIRING, read off the route's source — no type can say "the anchor the
// rule returned is the anchor Stripe is given", and this is money.
// ─────────────────────────────────────────────────────────────────────────────
describe('the join route bills the cohort through this rule', () => {
  const src = readFileSync(new URL('../routes/membership.ts', import.meta.url), 'utf8');

  it('asks the rule with the tier’s own date AND the interval', () => {
    expect(src).toContain('const fixedPeriod = fixedFirstPeriod(');
    expect(src).toContain('.first_period_ends_on');
    // The interval is not decoration: without it the rule defaults to 'year'
    // and a MONTHLY join would take the cohort's price — one month's money
    // for the rest of the year.
    expect(src).toContain('d.interval,');
  });

  it('sets the anchor AND turns proration off — one without the other is a bug', () => {
    // proration_behavior 'none' is the single word that decides "exactly one
    // charge now": without it Stripe adds a pro-rata charge for today→anchor
    // on top of the one-off line.
    // ONE fragment, not two. `proration_behavior: 'none'` also appears in the
    // tier-change code three hundred lines away, so asserting it separately
    // passed even with the join route's copy removed — found by mutating it
    // and watching this test stay green, which is what mutation is for.
    expect(src).toContain(
      "{ billing_cycle_anchor: fixedPeriod.anchor, proration_behavior: 'none' as const }",
    );
  });

  it('makes the paid-now line ONE-OFF for the cohort, or the period is billed twice', () => {
    expect(src).toContain('...(fixedPeriod ? {} : { recurring: { interval: d.interval } })');
  });

  it('and never uses trial_end, which Stripe refuses inside 48 hours', () => {
    // The 30 December joiner is in this cohort by design; trial_end would
    // make their join fail at the API.
    expect(src).not.toContain('trial_end');
  });
});
