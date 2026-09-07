// The pricing LOGIC engine — declarative money rules evaluated at
// checkout. First-match-wins, unknown context never matches (no
// accidental discounts), clamped percentages. This is exactly the kind of
// logic the testing approach says gets unit tests: pure, intricate, and
// the blast radius is money.

import { describe, expect, it } from 'vitest';
import { applyPct, evaluatePriceLogic, type PriceLogic } from './pricing.js';

const logic: PriceLogic = {
  rules: [
    { when: { attr: 'country', op: 'in', values: ['gr', 'PT'] }, pct: 60, label: 'PPP' },
    { when: { attr: 'interval', op: 'in', values: ['year'] }, pct: 90 },
    { when: { attr: 'country', op: 'not_in', values: ['NL'] }, pct: 80 },
  ],
  default_pct: 100,
};

describe('evaluatePriceLogic', () => {
  it('no logic → 100%, no match', () => {
    expect(evaluatePriceLogic(null, { country: 'GR' })).toEqual({ pct: 100, matched: null });
    expect(evaluatePriceLogic(undefined, {})).toEqual({ pct: 100, matched: null });
  });

  it('first matching rule wins, case-insensitively both ways', () => {
    expect(evaluatePriceLogic(logic, { country: 'gr' }).pct).toBe(60);
    expect(evaluatePriceLogic(logic, { country: 'PT', interval: 'year' }).pct).toBe(60);
  });

  it('later rules apply when earlier ones miss', () => {
    // NL misses the PPP rule; no interval; NL is IN the not_in set → default.
    expect(evaluatePriceLogic(logic, { country: 'NL' }).pct).toBe(100);
    // DE misses PPP, no interval, not_in NL matches → 80.
    expect(evaluatePriceLogic(logic, { country: 'DE' }).pct).toBe(80);
    // NL + yearly: interval rule matches before the not_in rule.
    expect(evaluatePriceLogic(logic, { country: 'NL', interval: 'year' }).pct).toBe(90);
  });

  it('unknown context never matches — no accidental discounts', () => {
    // No country given: country rules (incl. not_in!) are skipped entirely.
    expect(evaluatePriceLogic(logic, {}).pct).toBe(100);
  });

  it('clamps rule and default percentages into 1..1000, NaN → 100', () => {
    const weird: PriceLogic = {
      rules: [{ when: { attr: 'country', op: 'in', values: ['GR'] }, pct: 0 }],
      default_pct: Number.NaN,
    };
    expect(evaluatePriceLogic(weird, { country: 'GR' }).pct).toBe(1);
    expect(evaluatePriceLogic(weird, { country: 'NL' }).pct).toBe(100);
    expect(
      evaluatePriceLogic(
        { rules: [], default_pct: 5000 },
        {},
      ).pct,
    ).toBe(1000);
  });

  it('malformed rules (missing when / non-array values) are skipped', () => {
    const broken = {
      rules: [{ when: null, pct: 10 }, { when: { attr: 'country', op: 'in', values: 'GR' }, pct: 10 }],
      default_pct: 100,
    } as unknown as PriceLogic;
    expect(evaluatePriceLogic(broken, { country: 'GR' }).pct).toBe(100);
  });
});

describe('applyPct', () => {
  it('rounds to the nearest cent and never goes negative', () => {
    expect(applyPct(1999, 60)).toBe(1199); // 1199.4 → 1199
    expect(applyPct(1999, 90)).toBe(1799); // 1799.1 → 1799
    expect(applyPct(1, 50)).toBe(1); // 0.5 rounds up
    expect(applyPct(0, 60)).toBe(0);
  });

  it('clamps the pct like the evaluator (0 → 1%, huge → 1000%)', () => {
    expect(applyPct(1000, 0)).toBe(10); // clamped to 1%
    expect(applyPct(1000, 99999)).toBe(10000); // clamped to 1000%
  });
});
