import { describe, expect, it } from 'vitest';
import { addonCharge } from './membership-change.js';

describe('addonCharge (Sjoerd 2026-10-17, choice A)', () => {
  it('a renewing add-on with a first-period end, added while prepaid (trialing): the full price now', () => {
    expect(addonCharge('recurring', 'trialing', '2026-12-31')).toBe('prepaid');
  });
  it('an active subscription stays pro rata, first-period end or not', () => {
    expect(addonCharge('recurring', 'active', '2026-12-31')).toBe('prorate');
    expect(addonCharge('recurring', 'active', null)).toBe('prorate');
  });
  it('no first-period end keeps today\'s behaviour, trialing or not', () => {
    expect(addonCharge('recurring', 'trialing', null)).toBe('prorate');
    expect(addonCharge('recurring', 'trialing', '')).toBe('prorate');
  });
  it('a one-off is its own invoice; no fit is no charge', () => {
    expect(addonCharge('once', 'trialing', '2026-12-31')).toBe('once');
    expect(addonCharge(null, 'trialing', '2026-12-31')).toBeNull();
  });
});
