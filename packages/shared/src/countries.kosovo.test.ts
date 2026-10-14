import { describe, expect, it } from 'vitest';
import { COUNTRIES, COUNTRY_OPTIONS, countryName } from './countries.js';

// ---------------------------------------------------------------------------
// KOSOVO, AND THE SHAPE OF THE LIST IT JOINED.
//
// XK is a user-assigned code, not official ISO 3166-1, which is why it was
// missing. The omission surfaced while mapping the World Bank income groups
// onto this list for soul.com's pricing — Kosovo is upper-middle income and
// there was no code to price it by — but the real cost was upstream: this
// list feeds the country picker on every public join page, so somebody in
// Kosovo could not say where they were at all.
//
// The tests below are not about Kosovo being present. They are about the
// assumptions a non-ISO code could break, each one checked rather than
// assumed.
// ---------------------------------------------------------------------------

describe('Kosovo', () => {
  it('is in the list, and in the picker', () => {
    expect(COUNTRIES.find((c) => c.code === 'XK')).toEqual({ code: 'XK', name: 'Kosovo' });
    expect(COUNTRY_OPTIONS.find((o) => o.value === 'XK')?.label).toBe('Kosovo');
  });

  it('resolves to a name like any other code', () => {
    expect(countryName('XK')).toBe('Kosovo');
    expect(countryName('xk')).toBe('Kosovo');
  });

  it('satisfies the two-letter rule every country field validates with', () => {
    // The API validates `country` as /^[A-Za-z]{2}$/ in four places. A code
    // that failed it would be selectable and unsaveable, which is worse than
    // absent.
    for (const c of COUNTRIES) {
      expect(/^[A-Z]{2}$/.test(c.code), c.code).toBe(true);
    }
  });
});

describe('the list as a whole', () => {
  it('has no duplicate codes', () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(codes.length).toBe(new Set(codes).size);
  });

  it('stays in code order, which the file says it is in', () => {
    // The comment above COUNTRY_OPTIONS says this list is in ISO-code order
    // and that the PICKER is the thing sorted by name. A new entry dropped in
    // the wrong place would make that comment a lie quietly.
    const codes = COUNTRIES.map((c) => c.code);
    expect(codes).toEqual([...codes].sort());
  });

  it('offers the picker by name, not by code', () => {
    // The bug this ordering fixed: the dropdown used to open on Andorra,
    // United Arab Emirates, Afghanistan.
    const labels = COUNTRY_OPTIONS.map((o) => o.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });
});
