// The one calculation, pinned.
//
// `enrolmentPrice` decides what somebody pays, and three surfaces will read
// it: the enrol POST that charges, the ledger row that records why, and the
// member's own list of what they could join. So the arithmetic is tested here
// rather than through any of them — a price is the kind of thing that must be
// the same number in all three places, and a unit test is the only cheap way
// to say so.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  couponPriceOf,
  enrolmentPrice,
  priceCurrencyOf,
  provenEmail,
  resolveBasePrice,
  teamCalendarConfig,
} from './member-discount.js';

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

describe('provenEmail — who gets the member price', () => {
  // The five cases the member price turns on. Each one is a different person
  // standing at the same form.
  it('ANONYMOUS gets no member price', () => {
    expect(provenEmail(null, 'member@example.com')).toBeNull();
  });

  it('an EXPIRED or FORGED token gets no member price, and no error', () => {
    // participantEmailFromAuth answers null for both — a token that does not
    // verify is indistinguishable from no token, deliberately, so a broken
    // one cannot make this route behave differently from an anonymous one.
    expect(provenEmail(null, 'member@example.com')).toBeNull();
  });

  it('a SIGNED-IN NON-MEMBER gets no member price (and the lookup is never reached)', () => {
    // provenEmail says yes — it is the same person — and the entitlement
    // walk then answers null because there is no membership. Two different
    // questions, in that order.
    expect(provenEmail('stranger@example.com', 'stranger@example.com')).toBe(
      'stranger@example.com',
    );
  });

  it('a SIGNED-IN MEMBER enrolling THEMSELVES is proven', () => {
    expect(provenEmail('member@example.com', 'member@example.com')).toBe('member@example.com');
  });

  it('a SIGNED-IN MEMBER enrolling SOMEBODY ELSE gets the list price', () => {
    // The entitlement belongs to the member, not to whoever is filling the
    // form. Signing in does not let you spend your membership on a friend.
    expect(provenEmail('member@example.com', 'friend@example.com')).toBeNull();
  });

  it('case and whitespace do not decide who somebody is', () => {
    expect(provenEmail('  Member@Example.COM ', 'member@example.com')).toBe('member@example.com');
    expect(provenEmail('member@example.com', '  MEMBER@EXAMPLE.com')).toBe('member@example.com');
    expect(provenEmail('', 'member@example.com')).toBeNull();
    expect(provenEmail('member@example.com', '   ')).toBeNull();
  });
});

describe('the typed email cannot reach the entitlement', () => {
  // A TYPE cannot say "this string was verified", so this reads the call
  // site. If somebody passes the form's address to the member lookup, this
  // goes red — which is the whole protection, since the mistake it guards
  // against shipped once already and was caught in review rather than by a
  // test.
  const src = readFileSync(new URL('../routes/thread.ts', import.meta.url), 'utf8');

  it('the member lookup is called with the PROVEN address and nothing else', () => {
    const calls = [...src.matchAll(/memberDiscountForVerifiedEmail\(([^,)]+)/g)].map((m) =>
      m[1]!.trim(),
    );
    expect(calls.length, 'the lookup is called').toBeGreaterThan(0);
    for (const arg of calls) expect(arg, `argument: ${arg}`).toBe('proven');
  });

  it('the my-price endpoint has no email INPUT to be confused with the proven one', () => {
    // It calls the lookup with `proven` straight off the token rather than
    // through provenEmail(), which is only honest while the route reads no
    // address from the request. If one is ever added, this goes red and the
    // route owes a provenEmail() call like the enrol POST's.
    const start = src.indexOf("threadRoutes.get('/public/my-price'");
    expect(start, 'the endpoint exists').toBeGreaterThan(-1);
    const route = src.slice(start, src.indexOf('threadRoutes.', start + 10));
    expect(route, 'the lookup is in this route').toContain('memberDiscountForVerifiedEmail');
    expect(route).not.toMatch(/query\('email'\)|\bd\.email\b|body\.email/);
  });

  it('`proven` comes from the VERIFIED claim and the typed address together', () => {
    expect(src).toContain('const verifiedEmail = await participantEmailFromAuth(c);');
    expect(src).toContain('const proven = provenEmail(verifiedEmail, email);');
  });

  it('this file verifies no token of its own', () => {
    // One verifier: lib/participant-auth.ts. thread.ts carried a fourth copy
    // until 2026-10-12, and it had drifted — it returned the email in
    // whatever case the provider sent.
    expect(src).not.toContain('jwtVerify');
    expect(src).not.toContain('createRemoteJWKSet');
    expect(src).toContain("from '../lib/participant-auth.js'");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveBasePrice — WHICH ticket, and therefore what a discount applies to
// ─────────────────────────────────────────────────────────────────────────────
// Added 2026-10-12 with GET /thread/public/my-price. The quote and the charge
// now both call this, so the ways they used to be able to disagree are the
// cases worth pinning: a chosen ticket, no choice at all, a choice that is not
// on sale, a currency the ticket overrides.
describe('resolveBasePrice', () => {
  const thread = { price_cents: 3500, price_currency: 'EUR' };
  const tickets = [
    { id: 'full', price_cents: 5000 },
    { id: 'reduced', price_cents: 2000 },
  ];

  it('uses the chosen ticket, not the cheapest', () => {
    const r = resolveBasePrice(thread, tickets, 'full');
    expect(r.basePriceCents).toBe(5000);
    expect(r.ticketId).toBe('full');
  });

  it('with no choice, uses the cheapest open ticket', () => {
    const r = resolveBasePrice(thread, tickets, null);
    expect(r.basePriceCents).toBe(2000);
    expect(r.ticketId).toBe('reduced');
  });

  it('does not reorder the caller\u2019s array while finding the cheapest', () => {
    const given = [...tickets];
    resolveBasePrice(thread, given, null);
    expect(given.map((t) => t.id)).toEqual(['full', 'reduced']);
  });

  it('with no tickets at all, uses the thread\u2019s own price', () => {
    const r = resolveBasePrice(thread, [], null);
    expect(r.basePriceCents).toBe(3500);
    expect(r.ticketId).toBeNull();
  });

  it('falls back to the cheapest when the chosen ticket is not open', () => {
    // Not an error here: a quote is not a reservation, and the POST does its
    // own 409 on exactly this case. What must NOT happen is answering with
    // the closed ticket's price.
    const r = resolveBasePrice(thread, tickets, 'gone');
    expect(r.ticketId).toBe('reduced');
    expect(r.basePriceCents).toBe(2000);
  });

  it('treats a thread with no price as free, not as NaN', () => {
    const r = resolveBasePrice({ price_cents: null, price_currency: 'EUR' }, [], null);
    expect(r.basePriceCents).toBe(0);
  });

  it('a ticket\u2019s own currency wins over the thread\u2019s', () => {
    const r = resolveBasePrice(
      thread,
      [{ id: 'gbp', price_cents: 1000, price_currency: 'GBP' }],
      null,
    );
    expect(r.priceCurrency).toBe('GBP');
  });

  it('a ticket without a currency inherits the thread\u2019s', () => {
    expect(
      resolveBasePrice({ price_cents: 1, price_currency: 'USD' }, tickets, 'full').priceCurrency,
    ).toBe('USD');
  });
});

describe('priceCurrencyOf', () => {
  it('reads the column', () => {
    expect(priceCurrencyOf({ price_currency: 'GBP' })).toBe('GBP');
  });
  it('and survives a null one, because the column is nullable', () => {
    expect(priceCurrencyOf({ price_currency: null })).toBe('EUR');
    expect(priceCurrencyOf({})).toBe('EUR');
  });
});
