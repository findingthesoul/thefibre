import { describe, it, expect } from 'vitest';
import {
  bookingConfirmationInvitee,
  bookingNotificationHost,
  bookingRescheduled,
  type EmailCommon,
} from './templates.js';

// A calendar entry names the person on the OTHER side of the meeting
// (Sjoerd, 2026-09-24). The two sides share one .ics route, so the ONLY
// thing separating the host's copy from the invitee's is `?for=host` in the
// link. A silent drop of that query string is invisible in the email and
// shows up weeks later as a host whose whole week reads "Intro call - Sjoerd
// Luteijn" — their own name, on every row. So it is asserted here, and the
// route's half is asserted against a real request in the deploy probe.
const common: EmailCommon = {
  inviteeName: 'Tuana',
  inviteeEmail: 'tuana@example.test',
  hostName: 'Sjoerd Luteijn',
  hostEmail: 'sjoerd@example.test',
  meetingName: 'personal meeting',
  startsAt: new Date('2026-09-28T13:00:00Z'),
  endsAt: new Date('2026-09-28T14:00:00Z'),
  hostTimezone: 'Europe/Amsterdam',
  bookingId: 'b1',
  meetAppUrl: 'https://meet.example.test',
  hostSlug: 'sjoerd-luteijn',
  meetingTypeSlug: 'personal-meeting',
};

const ICS = 'https://meet.example.test/sjoerd-luteijn/personal-meeting/confirmed/b1/calendar.ics';

describe('the Add to calendar link knows who is clicking it', () => {
  it("gives the invitee the invitee's file", () => {
    const { html, text } = bookingConfirmationInvitee(common);
    expect(html).toContain(`href="${ICS}"`);
    expect(text).toContain(ICS);
    expect(html).not.toContain('for=host');
  });

  it("gives the host the host's file", () => {
    const { html, text } = bookingNotificationHost(common);
    expect(html).toContain(`href="${ICS}?for=host"`);
    expect(text).toContain(`${ICS}?for=host`);
  });

  it('keeps the distinction when a booking moves', () => {
    const was = new Date('2026-09-27T13:00:00Z');
    expect(bookingRescheduled(common, 'host', was).html).toContain(`${ICS}?for=host`);
    expect(bookingRescheduled(common, 'invitee', was).html).not.toContain('for=host');
  });
});
