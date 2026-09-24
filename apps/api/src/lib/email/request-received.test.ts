import { describe, it, expect } from 'vitest';
import { bookingRequestReceived, type EmailCommon } from './templates.js';

// The approval-pending mail was hand-written at the call site and carried no
// links at all, so a person whose request was waiting had no way back to it
// (Sjoerd, 2026-09-24: "the reschedule option is not there"). It is a
// template now, using the same URL builders as every other booking mail —
// which is only worth anything if something checks the links are actually in
// the rendered output.
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

const BASE = 'https://meet.example.test/sjoerd-luteijn/personal-meeting';

describe('the request-received mail', () => {
  it('offers a different time and a way out, in both parts', () => {
    const { html, text } = bookingRequestReceived(common);
    for (const body of [html, text]) {
      expect(body).toContain(`${BASE}?reschedule=b1`);
      expect(body).toContain(`${BASE}/cancel/b1`);
    }
  });

  it('offers no calendar file — nothing is confirmed yet', () => {
    const { html, text } = bookingRequestReceived(common);
    expect(html).not.toContain('calendar.ics');
    expect(text).not.toContain('calendar.ics');
  });

  it('says whose desk it is on, and that a confirmation follows', () => {
    const { subject, html } = bookingRequestReceived(common);
    expect(subject).toBe('Request received: personal meeting');
    expect(html).toContain('Sjoerd Luteijn');
    expect(html).toContain("once it's approved");
  });
});
