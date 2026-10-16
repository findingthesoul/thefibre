// The one rule for "owns this product" (2026-10-16): a one-off is owned for
// good; a recurring grant only while its subscription lives.

import { describe, expect, it } from 'vitest';
import { grantStatusFor, isRecurringInterval, LIVE_PURCHASE_STATUSES } from './product-ownership.js';

describe('product ownership', () => {
  it('live: paid (one-off), active and past_due (a subscription, through grace)', () => {
    expect([...LIVE_PURCHASE_STATUSES].sort()).toEqual(['active', 'paid', 'past_due']);
    expect(LIVE_PURCHASE_STATUSES).not.toContain('cancelled');
    expect(LIVE_PURCHASE_STATUSES).not.toContain('refunded');
  });
  it('a new grant: a one-off starts paid, a renewing product active; NULL interval is once', () => {
    expect(grantStatusFor('once')).toBe('paid');
    expect(grantStatusFor(null)).toBe('paid');
    expect(grantStatusFor(undefined)).toBe('paid');
    for (const iv of ['week', 'month', 'year']) {
      expect(grantStatusFor(iv)).toBe('active');
      expect(isRecurringInterval(iv)).toBe(true);
    }
    expect(isRecurringInterval(null)).toBe(false);
  });
});
