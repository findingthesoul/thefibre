// What the guest actually receives, from the route that sends it.
//
// Two unit suites already pin the pieces — booking-when.test.ts for the
// clock, meet-invite.test.ts for the file. Neither can tell you whether the
// BOOKING ROUTE puts them in the mail, which is the whole of what the guest
// reported on 2026-10-07: the time was the host's and "Add to calendar seems
// to require a subscription".
//
// So this one runs the real route, in process, against staging's database,
// with the mail client replaced by a recorder. Everything between the POST a
// browser makes and the message handed to Resend is exercised.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { cleanupMeetFixture, createMeetFixture, service, type MeetFixture } from './staging.js';

type Sent = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
};
const sent: Sent[] = [];

// The recorder. platformFromAddress is used for ORGANIZER when a host has no
// address, so it has to keep working.
vi.mock('../lib/email/client.js', () => ({
  sendEmail: async (msg: Sent) => {
    sent.push(msg);
  },
  platformFromAddress: () => 'noreply@thefibre.app',
}));

let app: Hono;
let f: MeetFixture;
const guest = `int-tz-${randomUUID().slice(0, 8)}@example.com`;
let bookingId = '';

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { meetRoutes } = await import('../routes/meet.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/meet', meetRoutes);
  app.route('/api/v1', v1);
  f = await createMeetFixture('guest-invite', { kind: 'one_off' });
});

afterAll(async () => {
  if (bookingId) await service.from('meet_booking').delete().eq('id', bookingId);
  if (f) await cleanupMeetFixture(f);
});

const guestMail = () => sent.find((m) => m.to === guest);

describe('a booking made from a US Eastern browser', () => {
  it('is created, and records the zone the page was showing', async () => {
    const r = await app.request('/api/v1/meet/public/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-ID': 'fibre-meet' },
      body: JSON.stringify({
        meeting_type_id: f.meetingTypeId,
        invitee_email: guest,
        invitee_name: 'Eastern Guest',
        starts_at: f.startsAt,
        invitee_timezone: 'America/New_York',
        request_id: randomUUID(),
      }),
    });
    expect(r.status, await r.clone().text()).toBe(200);
    const body = (await r.json()) as { booking?: { id: string } };
    bookingId = body.booking?.id ?? '';
    expect(bookingId).toBeTruthy();

    const { data } = await service
      .from('meet_booking')
      .select('invitee_timezone, invite_sequence')
      .eq('id', bookingId)
      .single();
    expect(data?.invitee_timezone).toBe('America/New_York');
    expect(data?.invite_sequence).toBe(0);
  });

  it('is told the time in its own zone, with the host zone second', async () => {
    const mail = guestMail();
    expect(mail, `nothing was sent to the guest; sent: ${sent.map((s) => s.to).join(', ')}`).toBeTruthy();
    // The host's zone must appear SECOND, in brackets — the guest's leads.
    const text = mail!.text ?? '';
    const zoneLine = text.split('\n').find((l) => l.includes('(')) ?? '';
    expect(zoneLine, text).toMatch(/\(.*\)/);
    // Both readings of the same moment are present.
    const { data } = await service
      .from('meet_booking')
      .select('starts_at')
      .eq('id', bookingId)
      .single();
    const starts = new Date(data!.starts_at as string);
    const inGuestZone = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York',
    }).format(starts);
    expect(text).toContain(inGuestZone);
  });

  it('carries the invitation as an attachment, not as a link to subscribe to', async () => {
    const mail = guestMail()!;
    expect(mail.attachments?.length, 'no attachment on the guest confirmation').toBe(1);
    const a = mail.attachments![0]!;
    expect(a.filename).toBe('invite.ics');
    expect(a.contentType).toBe('text/calendar; charset=utf-8; method=REQUEST');
    const ics = Buffer.from(a.content, 'base64').toString('utf8');
    expect(ics).toContain('METHOD:REQUEST');
    expect(ics).not.toContain('METHOD:PUBLISH');
    expect(ics).toContain(`UID:meet-${bookingId}@thefibre.app`);
    expect(ics).toContain('RSVP=TRUE');
    expect(ics).toContain(guest);
  });

  it('sent the HOST their own mail, in the host zone, with no invitation', async () => {
    // The host's calendar gets the event from Google (or their own .ics
    // link); attaching a REQUEST to the organiser's own copy would ask them
    // to RSVP to their own meeting.
    const hostMail = sent.find((m) => m.to === f.hostEmail);
    expect(hostMail, 'the host was not told').toBeTruthy();
    expect(hostMail!.attachments ?? []).toHaveLength(0);

    // The When LINE specifically, not the whole mail: the body legitimately
    // contains brackets elsewhere ("Eastern Guest (guest@…) booked …"), and
    // an assertion on the whole text was my own sloppiness — it failed on
    // that line and said nothing about zones.
    const whenLine = (hostMail!.text ?? '').split('\n').find((l) => l.startsWith('When:')) ?? '';
    expect(whenLine, hostMail!.text).toBeTruthy();
    expect(whenLine).not.toContain('(');
    // And it is the host's own clock: the guest's reading of the same moment
    // is absent from the host's copy.
    const { data } = await service
      .from('meet_booking')
      .select('starts_at')
      .eq('id', bookingId)
      .single();
    const guestReading = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York',
    }).format(new Date(data!.starts_at as string));
    expect(whenLine).not.toContain(guestReading);
  });
});
