// The one calculation, pinned.
//
// `enrolmentPrice` decides what somebody pays, and three surfaces will read
// it: the enrol POST that charges, the ledger row that records why, and the
// member's own list of what they could join. So the arithmetic is tested here
// rather than through any of them — a price is the kind of thing that must be
// the same number in all three places, and a unit test is the only cheap way
// to say so.

import { describe, expect, it } from 'vitest';
import { couponPriceOf, enrolmentPrice, teamCalendarConfig } from './member-discount.js';

const pct = (n: number) => ({ type: 'percentage', discount_percentage: n });
const off = (cents: number) => ({ type: 'fixed', discount_amount_cents: cents });

describe('couponPriceOf', () => {
  it('free is free, percentage rounds, fixed subtracts, and nothing goes below zero', () => {
    expect(couponPriceOf({ type: 'free' }, 3500)).toBe(0);
    expect(couponPriceOf(pct(50), 3500)).toBe(1750);
    // 33% of 999 is 659.67 — the rounding is the product's, not the reader's.
    expect(couponPriceOf(pct(33), 999)).toBe(669);
    expect(couponPriceOf(off(1000), 3500)).toBe(2500);
    expect(couponPriceOf(off(9900), 3500)).toBe(0);
  });
});

describe('enrolmentPrice', () => {
  it('no coupon and no membership is the list price', () => {
    expect(enrolmentPrice(3500, null, null)).toEqual({ cents: 3500, reason: 'full' });
  });

  it('a membership percentage applies to the resolved base', () => {
    // The base is whatever the POST already resolved — the chosen ticket, or
    // the cheapest open one. The percentage does not need to know which.
    expect(enrolmentPrice(3500, null, 20)).toEqual({ cents: 2800, reason: 'membership' });
    expect(enrolmentPrice(3500, null, 100)).toEqual({ cents: 0, reason: 'membership' });
  });

  it('BEST OF THE TWO, never stacked', () => {
    // 30% member + 50% code on €35: stacked would be €12.25, which is an
    // offer nobody made. The better single discount wins.
    expect(enrolmentPrice(3500, pct(50), 30)).toEqual({ cents: 1750, reason: 'coupon' });
    expect(enrolmentPrice(3500, pct(10), 30)).toEqual({ cents: 2450, reason: 'membership' });
    // A member is never worse off for holding a weak code…
    expect(enrolmentPrice(3500, pct(5), 50).cents).toBe(1750);
    // …and a code-holder is never worse off for being a member.
    expect(enrolmentPrice(3500, pct(90), 10).cents).toBe(350);
  });

  it('a tie is called a coupon, because the person typed it', () => {
    expect(enrolmentPrice(3500, pct(20), 20)).toEqual({ cents: 2800, reason: 'coupon' });
  });

  it('a free thread stays free, and says so plainly', () => {
    expect(enrolmentPrice(0, null, 100)).toEqual({ cents: 0, reason: 'membership' });
    expect(enrolmentPrice(0, null, null)).toEqual({ cents: 0, reason: 'full' });
  });

  it('a percentage outside 1..100 is not a discount this product offers', () => {
    // The write path refuses to store these; if one appears anyway, it is
    // ignored rather than turned into a price. 0 is the one that matters: a
    // 0% grant is a promise with nothing behind it.
    for (const bad of [0, -10, 101, Number.NaN, Infinity]) {
      expect(enrolmentPrice(3500, null, bad), `pct ${bad}`).toEqual({
        cents: 3500,
        reason: 'full',
      });
    }
  });

  it('never returns a negative or fractional amount', () => {
    expect(enrolmentPrice(999, null, 33)).toEqual({ cents: 669, reason: 'membership' });
    expect(enrolmentPrice(1, null, 99)).toEqual({ cents: 0, reason: 'membership' });
    expect(enrolmentPrice(-500, null, null).cents).toBe(0);
  });
});

describe('teamCalendarConfig', () => {
  it('reads a team and a percentage', () => {
    expect(teamCalendarConfig({ team_id: 'abc', discount_pct: 20 })).toEqual({
      teamId: 'abc',
      pct: 20,
    });
  });

  it('defaults to 100 only when the percentage is MISSING', () => {
    expect(teamCalendarConfig({ team_id: 'abc' })).toEqual({ teamId: 'abc', pct: 100 });
    expect(teamCalendarConfig({ team_id: 'abc', discount_pct: null })).toEqual({
      teamId: 'abc',
      pct: 100,
    });
    // A stored 0 is refused at the door. Reading it as "missing, so 100"
    // would turn a nonsense grant into a free calendar — the loudest
    // possible version of the bug this kind already had once.
    expect(teamCalendarConfig({ team_id: 'abc', discount_pct: 0 })).toBeNull();
  });

  it('refuses a grant with no team, and a percentage out of range', () => {
    expect(teamCalendarConfig({})).toBeNull();
    expect(teamCalendarConfig({ team_id: '   ' })).toBeNull();
    expect(teamCalendarConfig({ team_id: 'abc', discount_pct: 101 })).toBeNull();
    expect(teamCalendarConfig({ team_id: 'abc', discount_pct: 'twenty' })).toBeNull();
    expect(teamCalendarConfig(null)).toBeNull();
  });

  it('takes a numeric string, because a form field is text', () => {
    expect(teamCalendarConfig({ team_id: 'abc', discount_pct: '20' })).toEqual({
      teamId: 'abc',
      pct: 20,
    });
  });
});
