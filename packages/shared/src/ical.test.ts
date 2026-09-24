// A malformed .ics fails silently in the invitee's calendar app — nothing
// errors, the event just never appears. So the escaping rules are locked.

import { describe, expect, it } from 'vitest';
import { bookingCalendarTitle, buildBookingIcal, buildCalendarFeed } from './ical.js';

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

describe('bookingCalendarTitle', () => {
  it('names the counterpart after the meeting', () => {
    expect(bookingCalendarTitle('Intro call', 'Daniel Ross')).toBe('Intro call - Daniel Ross');
  });

  it('is perspective-dependent — each side names the other', () => {
    // The same booking, two calendars. This is the whole point of the helper:
    // neither side reads its own name back.
    const meeting = 'Intro call';
    const host = 'Marja de Vries';
    const invitee = 'Daniel Ross';
    expect(bookingCalendarTitle(meeting, invitee)).toBe('Intro call - Daniel Ross');
    expect(bookingCalendarTitle(meeting, host)).toBe('Intro call - Marja de Vries');
  });

  it('stands alone when there is nobody to name', () => {
    expect(bookingCalendarTitle('Intro call', null)).toBe('Intro call');
    expect(bookingCalendarTitle('Intro call', undefined)).toBe('Intro call');
    expect(bookingCalendarTitle('Intro call', '   ')).toBe('Intro call');
  });

  it('trims a padded name rather than widening the gap', () => {
    expect(bookingCalendarTitle('Intro call', '  Daniel Ross ')).toBe('Intro call - Daniel Ross');
  });
});

// A subscription feed is read again and again, so the properties that matter
// are the ones that hold ACROSS fetches: same uid for the same session, and a
// document a client will re-read rather than treat as a one-off import.
describe('buildCalendarFeed', () => {
  const two = [
    { ...base, uid: 'agenda-1@thefibre', summary: 'Opening circle' },
    {
      ...base,
      uid: 'agenda-2@thefibre',
      summary: 'Closing circle',
      startsAt: new Date('2026-11-02T09:00:00Z'),
      endsAt: new Date('2026-11-02T11:00:00Z'),
    },
  ];

  it('puts every event in one calendar', () => {
    const ics = buildCalendarFeed({ name: 'My sessions', events: two });
    expect(ics.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('UID:agenda-1@thefibre');
    expect(ics).toContain('UID:agenda-2@thefibre');
  });

  it('names the calendar in both spellings clients read', () => {
    const ics = buildCalendarFeed({ name: 'My sessions', events: [] });
    expect(ics).toContain('NAME:My sessions');
    expect(ics).toContain('X-WR-CALNAME:My sessions');
  });

  it('asks to be re-read, in the largest whole unit', () => {
    expect(buildCalendarFeed({ name: 'x', events: [] })).toContain(
      'REFRESH-INTERVAL;VALUE=DURATION:PT4H',
    );
    expect(
      buildCalendarFeed({ name: 'x', events: [], refreshMinutes: 90 }),
    ).toContain('X-PUBLISHED-TTL:PT90M');
    expect(buildCalendarFeed({ name: 'x', events: [], refreshMinutes: 1440 })).toContain(
      'REFRESH-INTERVAL;VALUE=DURATION:P1D',
    );
  });

  it('stays valid with no events at all — a person with an empty agenda still subscribes', () => {
    const ics = buildCalendarFeed({ name: 'My sessions', events: [] });
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('escapes a calendar name the same way it escapes an event field', () => {
    const ics = buildCalendarFeed({ name: 'Athens, 2026; day one', events: [] });
    expect(ics).toContain('X-WR-CALNAME:Athens\\, 2026\\; day one');
  });

  // The one that would otherwise be found by a person with two copies of
  // every session in their calendar, months later.
  it('emits the SAME document for the same input, so a re-fetch corrects rather than duplicates', () => {
    const at = new Date('2026-09-24T12:00:00Z');
    const a = buildCalendarFeed({ name: 'My sessions', events: two, generatedAt: at });
    const b = buildCalendarFeed({ name: 'My sessions', events: two, generatedAt: at });
    expect(a).toBe(b);
  });

  it('builds the same VEVENT as a single-file download, so the two cannot drift', () => {
    const at = new Date('2026-09-24T12:00:00Z');
    const single = buildBookingIcal({ ...base, generatedAt: at });
    const feed = buildCalendarFeed({ name: 'x', events: [base], generatedAt: at });
    const block = (s: string) => s.slice(s.indexOf('BEGIN:VEVENT'), s.indexOf('END:VEVENT'));
    expect(block(feed)).toBe(block(single));
  });
});
