import { describe, expect, it } from 'vitest';
import { bookingRescheduled, type EmailCommon } from './templates.js';

// Found by running the Zoom end-to-end on staging, 2026-10-01. Sjoerd
// screenshotted the moved-booking email: the body was right, and the PREVIEW
// line read "Booking moved; new date is Monday, 12 October 2026 at 14:00
// CEST" for a meeting that starts at 13:30. 14:00 is the END.
//
// The first explanation offered was a preheader reading `ends_at`. That would
// have been a tidy fix to a thing that does not exist — these emails have no
// preheader. A mail client builds the preview from whatever text comes first,
// and the When line printed the WHOLE date on both sides:
//
//   "Monday, 12 October 2026 at 13:30 CEST → Monday, 12 October 2026 at 14:00 CEST"
//
// so its tail is a complete-looking date-time standing where a date should
// be. Anything that truncates — a preview, a notification, somebody skimming
// — lands on the end time and reads it as the start.
//
// The rule these pin: the START is what the line leads with, and the end
// never appears as a date of its own on a same-day booking.

const base = (startsAt: Date, endsAt: Date): EmailCommon =>
  ({
    bookingId: 'b1',
    meetingName: 'Zoom Test',
    hostName: 'Sjoerd Luteijn',
    hostSlug: 'sjoerd-luteijn-z5i',
    hostTimezone: 'Europe/Amsterdam',
    meetingTypeSlug: 'zoom-test',
    inviteeName: 'Zoom E2E Test',
    inviteeEmail: 'invitee@example.invalid',
    meetAppUrl: 'https://meet.thefibre.tech',
    startsAt,
    endsAt,
  }) as unknown as EmailCommon;

/** The exact booking from the staging run. */
const START = new Date('2026-10-12T11:30:00Z'); // 13:30 CEST
const END = new Date('2026-10-12T12:00:00Z'); //   14:00 CEST

describe('the When line on a same-day booking', () => {
  const { text, html } = bookingRescheduled(base(START, END), 'invitee', new Date('2026-10-09T12:00:00Z'));

  // Assert on the WHEN LINE, not on the whole email. The first draft of these
  // checked the full body for "October 2026 at 14:00" and failed — because
  // the struck-through previous time legitimately IS 14:00 on 9 October. The
  // assertion has to name the thing it is about; a whole-document match
  // catches the bug and the correct content beside it.
  const whenLine = text.split('\n').find((l) => l.trimStart().startsWith('When'))!;

  it('has a When line at all', () => {
    expect(whenLine).toBeDefined();
  });

  it('names the date ONCE, not on both sides of the range', () => {
    // Two full dates is what let the end masquerade as the start.
    expect(whenLine.match(/12 October 2026/g)?.length).toBe(1);
  });

  it('leads with the start time', () => {
    expect(whenLine).toContain('13:30');
  });

  it('shows the end as a bare time, never as a second date', () => {
    expect(whenLine).toMatch(/13:30\s*–\s*14:00/);
    expect(whenLine).not.toMatch(/October 2026 at 14:00/);
  });

  it('prints the timezone once in that line', () => {
    expect(whenLine.match(/CEST/g)?.length).toBe(1);
  });

  it('the HTML carries the same collapsed range', () => {
    // Two halves of one email disagreeing is its own bug, and a preview is
    // built from the HTML.
    expect(html).toMatch(/13:30\s*–\s*14:00/);
    expect(html).not.toMatch(/12 October 2026 at 14:00/);
  });

  it('the previous time is still shown, struck through, as Was', () => {
    // The move is only legible if the old time is there to compare against.
    expect(text).toContain('9 October 2026');
    expect(html).toContain('<s>');
  });
});

describe('a range that genuinely crosses midnight', () => {
  it('keeps both dates, because there the second one is information', () => {
    const { text } = bookingRescheduled(
      base(new Date('2026-10-12T21:30:00Z'), new Date('2026-10-12T23:30:00Z')),
      'invitee',
      new Date('2026-10-09T12:00:00Z'),
    );
    // 23:30 and 01:30 CEST — different days in Amsterdam.
    expect(text).toContain('12 October 2026');
    expect(text).toContain('13 October 2026');
  });
});
