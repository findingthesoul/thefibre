// The rule that decides whether a workspace's scheduled mail waits.
//
// Its own test because the scheduler and every screen that explains the state
// must give the same answer, and because two of its four branches are easy to
// get backwards in a way no customer would report politely.

import { describe, expect, it } from 'vitest';
import { shouldHold } from './email-cap.js';

const FREE = { enabled: true, included: 200, overageCentsPer1000: null };
const PAID = { enabled: true, included: 2000, overageCentsPer1000: 100 };

describe('when scheduled mail waits', () => {
  // The switch that makes the whole mechanism inert as shipped. First,
  // because every other case below assumes it is on, and a reader who stops
  // after one test should learn this one.
  it('holds nothing at all while the feature is off, however far over the cap', () => {
    expect(shouldHold({ enabled: false, used: 999_999, included: 200, overageCentsPer1000: null })).toBe(false);
  });

  it('holds a Free workspace that has reached its allowance', () => {
    expect(shouldHold({ used: 200, ...FREE })).toBe(true);
    expect(shouldHold({ used: 5000, ...FREE })).toBe(true);
  });

  it('does not hold one that is still under', () => {
    expect(shouldHold({ used: 199, ...FREE })).toBe(false);
    expect(shouldHold({ used: 0, ...FREE })).toBe(false);
  });

  // The clause most likely to be "simplified" away by somebody reading this
  // as "hold past the cap".
  it('never holds a plan that BILLS past the cap, however far over it is', () => {
    expect(shouldHold({ used: 2000, ...PAID })).toBe(false);
    expect(shouldHold({ used: 999_999, ...PAID })).toBe(false);
  });

  it('never holds a plan with no allowance expressed', () => {
    expect(shouldHold({ enabled: true, used: 999_999, included: null, overageCentsPer1000: null })).toBe(false);
    expect(shouldHold({ enabled: true, used: 999_999, included: null, overageCentsPer1000: 100 })).toBe(false);
  });

  // `can()` FAILS OPEN: a workspace with no subscription row gets `true` for
  // every feature, including this one. That is deliberate elsewhere and would
  // be alarming here, so the second guard is what actually saves it — the
  // unknown plan carries includedEmailsMonth: null, and a null allowance never
  // holds. Two independent reasons, and this asserts the one that does not
  // depend on the switch.
  it('cannot hold a workspace with no plan, even with the feature reading as on', () => {
    expect(shouldHold({ enabled: true, used: 999_999, included: null, overageCentsPer1000: null })).toBe(false);
  });

  // A zero allowance is a real thing somebody could type at /admin/plans, and
  // reading it as "no allowance" would make the strictest plan the loosest.
  it('treats an allowance of zero as an allowance, not as absent', () => {
    expect(shouldHold({ enabled: true, used: 0, included: 0, overageCentsPer1000: null })).toBe(true);
  });
});
