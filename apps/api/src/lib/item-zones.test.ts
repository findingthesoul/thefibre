import { describe, expect, it } from 'vitest';
import { bookingZone, zoneOrNull } from './item-zones.js';

describe('zoneOrNull', () => {
  it('passes a real IANA zone through', () => {
    expect(zoneOrNull('Europe/Lisbon')).toBe('Europe/Lisbon');
    expect(zoneOrNull('America/New_York')).toBe('America/New_York');
  });
  it('refuses a typo, an empty string and a non-string', () => {
    expect(zoneOrNull('Athenes')).toBeNull();
    expect(zoneOrNull('')).toBeNull();
    expect(zoneOrNull(null)).toBeNull();
    expect(zoneOrNull(undefined)).toBeNull();
    expect(zoneOrNull(42)).toBeNull();
  });
});

describe('bookingZone', () => {
  it("prefers the guest's own zone", () => {
    expect(bookingZone({ invitee_timezone: 'America/New_York', host_timezone: 'Europe/Amsterdam' })).toBe('America/New_York');
  });
  it("falls back to the host's zone for an older booking", () => {
    expect(bookingZone({ invitee_timezone: null, host_timezone: 'Europe/Athens' })).toBe('Europe/Athens');
  });
  it("falls back to the host's zone when the guest's is not a real zone", () => {
    expect(bookingZone({ invitee_timezone: 'Athenes', host_timezone: 'Europe/Athens' })).toBe('Europe/Athens');
  });
  it('is null when neither is known', () => {
    expect(bookingZone({})).toBeNull();
    expect(bookingZone({ invitee_timezone: 'nope', host_timezone: '' })).toBeNull();
  });
});
