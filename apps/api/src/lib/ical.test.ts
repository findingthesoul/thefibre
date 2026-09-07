// A malformed .ics fails silently in the invitee's calendar app — nothing
// errors, the event just never appears. So the escaping rules are locked.

import { describe, expect, it } from 'vitest';
import { buildBookingIcal } from './ical.js';

const base = {
  uid: 'meet-abc@thefibre.app',
  startsAt: new Date('2026-09-10T09:00:00Z'),
  endsAt: new Date('2026-09-10T09:30:00Z'),
  summary: 'Intro call',
  organizerName: 'Marja de Vries',
  organizerEmail: 'marja@example.org',
  attendeeName: 'Daniel Ross',
  attendeeEmail: 'daniel@example.com',
};

describe('buildBookingIcal', () => {
  it('emits UTC stamps and CRLF line endings', () => {
    const ics = buildBookingIcal(base);
    expect(ics).toContain('DTSTART:20260910T090000Z');
    expect(ics).toContain('DTEND:20260910T093000Z');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('escapes the TEXT specials RFC 5545 reserves', () => {
    const ics = buildBookingIcal({
      ...base,
      summary: 'Strategy; planning, part 2',
      description: 'Line one\nLine two',
    });
    expect(ics).toContain('SUMMARY:Strategy\\; planning\\, part 2');
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two');
  });

  it('strips characters that would break a CN parameter', () => {
    const ics = buildBookingIcal({ ...base, organizerName: 'de Vries, Marja; "MJ"' });
    expect(ics).toContain('ORGANIZER;CN=de Vries Marja MJ:mailto:marja@example.org');
  });

  it('omits optional lines rather than emitting empty ones', () => {
    const ics = buildBookingIcal(base);
    expect(ics).not.toContain('DESCRIPTION:');
    expect(ics).not.toContain('LOCATION:');
  });

  it('carries CANCELLED status and a bumped sequence for a moved booking', () => {
    expect(buildBookingIcal({ ...base, status: 'CANCELLED' })).toContain('STATUS:CANCELLED');
    expect(buildBookingIcal({ ...base, sequence: 2 })).toContain('SEQUENCE:2');
  });
});
