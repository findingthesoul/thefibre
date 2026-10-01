import { describe, expect, it } from 'vitest';
import { formatWhenInZone } from './format-when.js';

// The booking the cancel page got wrong on 2026-10-01: 11:00 CEST in
// Amsterdam, which is 09:00 UTC. The page said 09:00 and named no zone.
const BOOKING = '2026-10-13T09:00:00.000Z';

describe('formatWhenInZone', () => {
  it('renders the booking in the zone it was made for', () => {
    const s = formatWhenInZone(BOOKING, 'Europe/Amsterdam', 'en-GB');
    expect(s).toContain('11:00');
    expect(s).toContain('13 October 2026');
  });

  it('names the zone, because an unlabelled time is the ambiguity itself', () => {
    expect(formatWhenInZone(BOOKING, 'Europe/Amsterdam', 'en-GB')).toMatch(/CEST|GMT\+2/);
  });

  it('is NOT the UTC reading — the two-hour error this module exists to stop', () => {
    const ams = formatWhenInZone(BOOKING, 'Europe/Amsterdam', 'en-GB');
    const utc = formatWhenInZone(BOOKING, 'UTC', 'en-GB');
    expect(ams).not.toEqual(utc);
    expect(utc).toContain('09:00');
  });

  it('follows the zone it is given, not the machine it runs on', () => {
    // Same instant, three zones, three readings. A formatter that ignored its
    // zone argument would return the same string for all of them — which is
    // exactly how the bug looked in review: correct-looking code.
    const readings = ['Europe/Amsterdam', 'America/New_York', 'Asia/Tokyo'].map((z) =>
      formatWhenInZone(BOOKING, z, 'en-GB'),
    );
    expect(new Set(readings).size).toBe(3);
  });

  it('follows the locale for the words', () => {
    expect(formatWhenInZone(BOOKING, 'Europe/Amsterdam', 'nl-NL')).toContain('oktober');
  });

  it('survives an unknown zone by falling back to UTC and saying so', () => {
    const s = formatWhenInZone(BOOKING, 'Mars/Olympus_Mons', 'en-GB');
    expect(s).toContain('09:00');
    expect(s).toMatch(/UTC|GMT/);
  });

  it('returns nothing for a date it cannot read, rather than "Invalid Date"', () => {
    expect(formatWhenInZone('not-a-date', 'Europe/Amsterdam', 'en-GB')).toBe('');
  });
});
