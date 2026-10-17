// The renewal day in membership mails is the same on every server
// (2026-10-17). It used to follow the host's zone: under TZ=America/
// Los_Angeles the welcome said "13 October" for a 14 October renewal, and on a
// UTC server a Stripe renewal at 00:30 Amsterdam time printed the day before.
// Fixed instants; run under TZ=UTC, Europe/Amsterdam and America/Los_Angeles.

import { describe, expect, it } from 'vitest';
import { longDate, membershipRenewalReminder, membershipWelcome } from './membership-templates.js';

describe('the renewal day, whatever the server’s zone', () => {
  it('an admin-set date (UTC midnight) is exactly the day picked', () => {
    expect(longDate('2027-10-14T00:00:00.000Z', 'en')).toBe('14 October 2027');
    expect(longDate('2027-10-14T00:00:00.000Z', 'nl')).toBe('14 oktober 2027');
  });
  it('a Stripe instant early on 14 October in Amsterdam is 14 October, not the 13th', () => {
    // 22:30 UTC on the 13th = 00:30 CEST on the 14th.
    expect(longDate('2027-10-13T22:30:00Z', 'en')).toBe('14 October 2027');
  });
  it('an ordinary Stripe instant', () => {
    expect(longDate('2027-10-14T05:03:20Z', 'en')).toBe('14 October 2027');
  });
  it('winter time too (CET, UTC+1)', () => {
    expect(longDate('2027-01-14T23:30:00Z', 'nl')).toBe('15 januari 2027');
  });
  it('an unreadable value is shown as given, never "Invalid Date"', () => {
    expect(longDate('soon', 'en')).toBe('soon');
  });
  it('the welcome and the reminder both say it', () => {
    const w = membershipWelcome({ name: 'Marja', communityName: 'soul.com', tierName: 'Member', renewsAt: '2027-10-13T22:30:00Z', email: 'm@example.com', locale: 'en' } as Parameters<typeof membershipWelcome>[0]);
    expect(w.text).toContain('14 October 2027');
    const r = membershipRenewalReminder({ name: 'Marja', communityName: 'soul.com', tierName: 'Member', renewsAt: '2027-10-13T22:30:00Z', amountCents: null, currency: 'EUR', locale: 'en' } as Parameters<typeof membershipRenewalReminder>[0]);
    expect(r.subject).toContain('14 October 2027');
  });
});
