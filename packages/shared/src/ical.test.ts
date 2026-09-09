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

// ---------------------------------------------------------------------------
// Lifted to @thefibre/shared in v0.68.28 so the visitor portal could render an
// agenda item's .ics without a second copy. Meet's calls are unchanged; these
// lock the parts the portal added, because a portal agenda item has no single
// host and the file is a download rather than an invitation.
// ---------------------------------------------------------------------------

describe('buildBookingIcal — the portal shape', () => {
  const item = {
    uid: 'agenda-xyz@thefibre',
    startsAt: new Date('2026-09-10T09:00:00Z'),
    endsAt: new Date('2026-09-10T10:00:00Z'),
    summary: 'Opening circle',
  };

  it('omits ORGANIZER and ATTENDEE entirely when there is no host or invitee', () => {
    const ics = buildBookingIcal(item);
    expect(ics).not.toContain('ORGANIZER');
    expect(ics).not.toContain('ATTENDEE');
    // Still a valid single event.
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Opening circle');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('emits ATTENDEE alone when only the reader is known', () => {
    const ics = buildBookingIcal({ ...item, attendeeEmail: 'visitor@example.com' });
    expect(ics).toContain('ATTENDEE;CN=visitor@example.com;RSVP=FALSE:mailto:visitor@example.com');
    expect(ics).not.toContain('ORGANIZER');
  });

  it('carries a URL and escapes it', () => {
    const ics = buildBookingIcal({ ...item, url: 'https://x.test/a,b' });
    expect(ics).toContain('URL:https://x.test/a\\,b');
  });

  it('defaults PRODID to Meet so existing bookings are byte-identical', () => {
    expect(buildBookingIcal(item)).toContain('PRODID:-//The Fibre//Meet//EN');
    expect(buildBookingIcal({ ...item, prodId: '-//X//Portal//EN' })).toContain(
      'PRODID:-//X//Portal//EN',
    );
  });
});
