// The guest's calendar invitation: is it an invitation at all?
//
// A real guest on production, 2026-10-07: "Add to calendar … seems to require
// a subscription rather than generating a standard calendar invite." The file
// behind that link says METHOD:PUBLISH, and a PUBLISH calendar fetched from a
// URL is exactly what a phone offers to subscribe to. These cases pin the
// three things that make the attachment a filable invitation instead, each of
// which looks fine when wrong.

import { describe, expect, it } from 'vitest';
import { bookingIcalUid, bookingInviteAttachment, type BookingInvite } from './meet-invite.js';

const booking: BookingInvite = {
  bookingId: '7c2f1a90-0000-4000-8000-000000000001',
  startsAt: new Date('2026-10-07T20:00:00Z'),
  endsAt: new Date('2026-10-07T20:30:00Z'),
  meetingName: 'Short call',
  description: 'A quick one.',
  location: 'https://zoom.us/j/123456789',
  hostName: 'Sjoerd Luteijn',
  hostEmail: 'host@example.com',
  guestName: 'Guest Person',
  guestEmail: 'guest@example.com',
  sequence: 0,
};

const body = (a: { content: string }) => Buffer.from(a.content, 'base64').toString('utf8');

describe('the attachment is an invitation', () => {
  it('says REQUEST in the body AND in the content type', () => {
    const a = bookingInviteAttachment(booking, 'REQUEST');
    // Both halves matter. The same bytes with a plain text/calendar type
    // arrive as a file to download and the calendar does nothing.
    expect(body(a)).toContain('METHOD:REQUEST');
    expect(a.contentType).toBe('text/calendar; charset=utf-8; method=REQUEST');
    expect(body(a)).not.toContain('METHOD:PUBLISH');
  });

  it('is a complete VCALENDAR a parser can read', () => {
    const text = body(bookingInviteAttachment(booking, 'REQUEST'));
    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(text.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(text).toContain('BEGIN:VEVENT');
    expect(text).toContain('END:VEVENT');
    expect(text).toContain('VERSION:2.0');
    // CRLF throughout: a bare \n is where some clients give up.
    expect(text.split('\n').every((l) => l === '' || l.endsWith('\r'))).toBe(true);
    expect(text).toContain('DTSTART:20261007T200000Z');
    expect(text).toContain('DTEND:20261007T203000Z');
  });

  it('puts the join link where a calendar will show it', () => {
    const text = body(bookingInviteAttachment(booking, 'REQUEST'));
    expect(text).toContain('LOCATION:https://zoom.us/j/123456789');
    // And in the description too, because some clients show one and not the
    // other, and a guest with neither has a meeting they cannot join.
    expect(text).toMatch(/DESCRIPTION:.*zoom\.us/);
  });

  it('names the HOST, not the guest — a calendar entry names the other side', () => {
    const text = body(bookingInviteAttachment(booking, 'REQUEST'));
    expect(text).toMatch(/SUMMARY:.*Sjoerd Luteijn/);
    expect(text).not.toMatch(/SUMMARY:.*Guest Person/);
    expect(text).toContain('ATTENDEE');
    expect(text).toContain('guest@example.com');
    expect(text).toMatch(/ORGANIZER[^\r\n]*host@example\.com/);
  });

  it('asks for an answer: RSVP is on', () => {
    expect(body(bookingInviteAttachment(booking, 'REQUEST'))).toContain('RSVP=TRUE');
  });
});

describe('the uid is the one thing that must not drift', () => {
  // The downloadable .ics in routes/meet.ts and this attachment both key on
  // it. Two different uids for one booking is two events in a guest's
  // calendar, and the second one is never cancelled.
  it('is the literal format both sides use', () => {
    expect(bookingIcalUid(booking.bookingId)).toBe(
      'meet-7c2f1a90-0000-4000-8000-000000000001@thefibre.app',
    );
  });

  it('is in the file, unchanged, for every method', () => {
    for (const method of ['REQUEST', 'CANCEL'] as const) {
      expect(body(bookingInviteAttachment(booking, method))).toContain(
        `UID:${bookingIcalUid(booking.bookingId)}`,
      );
    }
  });
});

describe('an update and a cancellation', () => {
  it('carries the sequence it is given, so a move can outrank what is held', () => {
    expect(body(bookingInviteAttachment({ ...booking, sequence: 0 }, 'REQUEST'))).toContain('SEQUENCE:0');
    expect(body(bookingInviteAttachment({ ...booking, sequence: 3 }, 'REQUEST'))).toContain('SEQUENCE:3');
  });

  it('a CANCEL says both CANCEL and CANCELLED', () => {
    const a = bookingInviteAttachment(booking, 'CANCEL');
    expect(body(a)).toContain('METHOD:CANCEL');
    // The method alone is not enough: the event's own STATUS has to say it
    // too, or some clients keep it on the calendar greyed out at best.
    expect(body(a)).toContain('STATUS:CANCELLED');
    expect(a.contentType).toContain('method=CANCEL');
  });
});

describe('a booking with less in it', () => {
  it('survives no location and no description', () => {
    const bare = { ...booking, location: null, description: null };
    const text = body(bookingInviteAttachment(bare, 'REQUEST'));
    expect(text).toContain('BEGIN:VEVENT');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
  });
});
