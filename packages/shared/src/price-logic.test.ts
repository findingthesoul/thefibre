import { describe, expect, it } from 'vitest';
import { applyPct, clampPct, evaluatePriceLogic, type PriceLogic } from './price-logic';

// ---------------------------------------------------------------------------
// THE TWO CASES THAT MADE THIS SHARED, first.
//
// The join panel had its own copy of this arithmetic so it could show a price
// before asking for money, and the copies agreed on every whole number
// between 1 and 100 — which is every rule anybody has written so far. They
// disagreed everywhere else, and the panel is a promise about what will be
// charged.
// ---------------------------------------------------------------------------
describe('the panel and the charge now agree', () => {
  it('rounds a fractional percentage, rather than showing it raw', () => {
    // The panel showed 12.5 and the server charged 13.
    expect(clampPct(12.5)).toBe(13);
    expect(evaluatePriceLogic({ default_pct: 12.5 }, {}).pct).toBe(13);
  });

  it('never resolves a priced tier to nothing', () => {
    // The panel showed free and the server charged 1%. A free membership is a
    // tier with no price — something an admin says on purpose — not the
    // accident of a pricing rule.
    expect(clampPct(0)).toBe(1);
    expect(clampPct(-50)).toBe(1);
    expect(applyPct(30000, 0)).toBe(300);
  });

  it('refuses to charge a hundred times the price on a typo', () => {
    expect(clampPct(10000)).toBe(1000);
  });

  it('treats nonsense as full price', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(clampPct(bad), String(bad)).toBe(100);
    }
  });
});

describe('which rule applies', () => {
  const logic: PriceLogic = {
    rules: [
      { when: { attr: 'country', op: 'in', values: ['GR', 'PT'] }, pct: 60 },
      { when: { attr: 'interval', op: 'in', values: ['year'] }, pct: 90 },
    ],
    default_pct: 100,
  };

  it('takes the first match, in order', () => {
    // Greece matches the first rule even though the second would also apply.
    expect(evaluatePriceLogic(logic, { country: 'GR', interval: 'year' }).pct).toBe(60);
    expect(evaluatePriceLogic(logic, { country: 'NL', interval: 'year' }).pct).toBe(90);
    expect(evaluatePriceLogic(logic, { country: 'NL', interval: 'month' }).pct).toBe(100);
  });

  it('matches regardless of case', () => {
    expect(evaluatePriceLogic(logic, { country: 'gr' }).pct).toBe(60);
  });

  it('never matches on a context it was not given', () => {
    // THE ONE THAT MATTERS. A missing country must not win somebody a
    // discount — a `not_in` rule would otherwise fire on everybody who had
    // not yet picked one, which on this form is everybody at first paint.
    const notIn: PriceLogic = {
      rules: [{ when: { attr: 'country', op: 'not_in', values: ['NL'] }, pct: 50 }],
      default_pct: 100,
    };
    expect(evaluatePriceLogic(notIn, {}).pct, 'no country given').toBe(100);
    expect(evaluatePriceLogic(notIn, { country: null }).pct, 'country explicitly null').toBe(100);
    expect(evaluatePriceLogic(notIn, { country: '' }).pct, 'empty country').toBe(100);
    // And it DOES fire once a country is known, so the case above is not
    // passing because the rule never works.
    expect(evaluatePriceLogic(notIn, { country: 'DE' }).pct).toBe(50);
  });

  it('ignores a rule it cannot read', () => {
    // The config is JSON from the database; an unknown attr or op is not a
    // crash and not a discount.
    const odd = {
      rules: [
        { when: { attr: 'phase_of_moon', op: 'in', values: ['waxing'] }, pct: 10 },
        { when: { attr: 'country', op: 'sideways', values: ['NL'] }, pct: 20 },
        { when: { attr: 'country', op: 'in', values: null as unknown as string[] }, pct: 30 },
      ],
      default_pct: 100,
    } as PriceLogic;
    expect(evaluatePriceLogic(odd, { country: 'NL' }).pct).toBe(100);
  });

  it('is full price with no logic at all', () => {
    expect(evaluatePriceLogic(null, { country: 'GR' })).toEqual({ pct: 100, matched: null });
    expect(evaluatePriceLogic(undefined, {})).toEqual({ pct: 100, matched: null });
    expect(evaluatePriceLogic({}, { country: 'GR' }).pct).toBe(100);
  });
});

describe('applying it to money', () => {
  it('rounds to the nearest cent', () => {
    expect(applyPct(19999, 50)).toBe(10000); // 99.995 → 100.00
    expect(applyPct(333, 33)).toBe(110); // 1.0989 → 1.10
  });

  it('is exact at full price', () => {
    expect(applyPct(30000, 100)).toBe(30000);
  });
});
