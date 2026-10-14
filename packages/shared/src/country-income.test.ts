import { describe, expect, it } from 'vitest';
import { COUNTRIES } from './countries.js';
import {
  COUNTRY_CATEGORY_PCT,
  WB_FY2027_CATEGORY_C,
  WB_FY2027_LOW,
  WB_FY2027_LOWER_MIDDLE,
  WB_FY2027_UPPER_MIDDLE,
} from './country-income-wb-fy2027.js';

// ---------------------------------------------------------------------------
// THE COUNTRY LISTS BEHIND A PRICE.
//
// These decide what somebody pays, so the tests are about the properties that
// would make a price silently wrong rather than about the contents, which are
// the World Bank's and not ours to assert.
//
// The list is edited by hand every July when the World Bank republishes. That
// is the moment these tests exist for.
// ---------------------------------------------------------------------------

const ALL = [...WB_FY2027_UPPER_MIDDLE, ...WB_FY2027_CATEGORY_C];

describe('every code', () => {
  it('exists in the shared country list', () => {
    // A code that is not in COUNTRIES cannot be chosen in any picker, so a
    // rule naming it is a discount nobody can claim. This is the check that
    // found Kosovo missing.
    const known = new Set(COUNTRIES.map((c) => c.code));
    const unknown = ALL.filter((c) => !known.has(c.code));
    expect(unknown.map((c) => `${c.wb} (${c.code})`)).toEqual([]);
  });

  it('is two upper-case letters', () => {
    for (const c of ALL) expect(/^[A-Z]{2}$/.test(c.code), `${c.wb}: ${c.code}`).toBe(true);
  });
});

describe('a country appears in exactly one category', () => {
  it('is never in both B and C', () => {
    // The evaluator takes the FIRST matching rule, so a country in both would
    // be priced by rule order — which is to say, by an accident of how the
    // list was written.
    const b = new Set(WB_FY2027_UPPER_MIDDLE.map((c) => c.code));
    const both = WB_FY2027_CATEGORY_C.filter((c) => b.has(c.code));
    expect(both.map((c) => c.wb)).toEqual([]);
  });

  it('is never listed twice within a category', () => {
    for (const [label, list] of [
      ['B', WB_FY2027_UPPER_MIDDLE],
      ['C lower-middle', WB_FY2027_LOWER_MIDDLE],
      ['C low', WB_FY2027_LOW],
    ] as const) {
      const codes = list.map((c) => c.code);
      expect(codes.length, label).toBe(new Set(codes).size);
    }
  });
});

describe('the lists themselves', () => {
  it('are the size the World Bank published for FY2027', () => {
    // 59 upper-middle, 47 lower-middle, 25 low. A test that would have to be
    // edited next July — on purpose: the edit is the moment to check the
    // count against their table rather than to trust a paste.
    expect(WB_FY2027_UPPER_MIDDLE).toHaveLength(59);
    expect(WB_FY2027_LOWER_MIDDLE).toHaveLength(47);
    expect(WB_FY2027_LOW).toHaveLength(25);
    expect(WB_FY2027_CATEGORY_C).toHaveLength(72);
  });

  it('keep the World Bank name beside every code', () => {
    // Without it, next July's update is a hunt rather than a diff.
    for (const c of ALL) expect(c.wb.trim().length, c.code).toBeGreaterThan(0);
  });
});

describe('the policy percentages', () => {
  it('are the three numbers the policy states', () => {
    expect(COUNTRY_CATEGORY_PCT).toEqual({ B: 75, C: 50, default: 100 });
  });

  it('are inside the range the price evaluator will honour', () => {
    // `clampPct` floors at 1 and ceilings at 1000, and the write path refuses
    // a 0. A policy number outside that would be silently rewritten.
    for (const pct of Object.values(COUNTRY_CATEGORY_PCT)) {
      expect(pct).toBeGreaterThanOrEqual(1);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });
});

describe('Category A is not listed', () => {
  it('and Chile is therefore absent, which is the point', () => {
    // Chile is high income, so the policy prices it at 100% — and it was
    // entered by hand at 75% before this data existed. Its absence here is a
    // decision (Sjoerd, 2026-10-14: "Chile 100%: follow your policy"), not an
    // omission, so it is worth a test that says so.
    expect(ALL.find((c) => c.code === 'CL')).toBeUndefined();
    expect(ALL.find((c) => c.code === 'CW')).toBeUndefined();
  });

  it('and neither is any obviously high-income country', () => {
    for (const code of ['NL', 'US', 'DE', 'CH', 'JP']) {
      expect(ALL.find((c) => c.code === code), code).toBeUndefined();
    }
  });
});
