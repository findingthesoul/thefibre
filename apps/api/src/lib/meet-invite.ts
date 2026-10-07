// The calendar invitation a Meet guest actually receives.
//
// Live feedback from a real guest on production, 2026-10-07: "Add to calendar
// … seems to require a subscription rather than generating a standard
// calendar invite." He was exactly right, and the reason is one word in the
// file. The link in the mail served a file built with METHOD:PUBLISH, and a
// PUBLISH calendar fetched from a URL is what iOS offers to SUBSCRIBE to,
// because nothing in it says "this is a meeting you are in". His phone did
// the only thing that file asked for.
//
// So the invitation now travels as an ATTACHMENT with METHOD:REQUEST, which
// is the thing every mail client and phone knows how to file (iMIP, RFC
// 5546) — the same mechanism Thread's session invitations already use. The
// download link stays for anyone who prefers it.
//
// ---------------------------------------------------------------------------
// Two things have to be right or a guest ends up with two meetings
// ---------------------------------------------------------------------------
// UID is `meet-<booking id>@thefibre.app` — a literal, NOT built from
// branding, and the SAME string the downloadable file uses. It is how a
// calendar knows the update and the download are one event rather than two.
//
// SEQUENCE must rise on every change, or the receiving calendar ignores the
// update and silently keeps the old time. `meet_booking.invite_sequence`
// holds it, bumped when a booking moves.

import { buildInviteIcal, icalContentType, bookingCalendarTitle } from '@thefibre/shared/ical';

export type BookingInvite = {
  bookingId: string;
  startsAt: Date;
  endsAt: Date;
  meetingName: string;
  description?: string | null;
  /** Join link or room; what the guest needs to actually turn up. */
  location?: string | null;
  hostName: string;
  hostEmail: string;
  guestName: string;
  guestEmail: string;
  sequence: number;
};

/** The UID a booking's calendar entry has, everywhere it appears. */
export function bookingIcalUid(bookingId: string): string {
  return `meet-${bookingId}@thefibre.app`;
}

/**
 * The attachment for one booking, as an invitation or as its cancellation.
 *
 * The guest's copy names the HOST — a calendar entry names the person on the
 * other side, and getting this backwards books somebody an hour with
 * themselves.
 */
export function bookingInviteAttachment(
  b: BookingInvite,
  method: 'REQUEST' | 'CANCEL',
): { filename: string; content: string; contentType: string } {
  const ics = buildInviteIcal({
    uid: bookingIcalUid(b.bookingId),
    method,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    summary: bookingCalendarTitle(b.meetingName, b.hostName),
    description: [b.description ?? null, b.location ? `Join: ${b.location}` : null]
      .filter(Boolean)
      .join('\n\n'),
    location: b.location ?? null,
    url: b.location ?? null,
    organizerName: b.hostName,
    organizerEmail: b.hostEmail,
    attendeeName: b.guestName,
    attendeeEmail: b.guestEmail,
    sequence: b.sequence,
    ...(method === 'CANCEL' ? { status: 'CANCELLED' as const } : {}),
  });
  return {
    // `invite.ics` is what Thread's invitations are called; the same name
    // keeps a client that groups by filename grouping these together.
    filename: 'invite.ics',
    content: Buffer.from(ics, 'utf8').toString('base64'),
    // The method is in the CONTENT TYPE as well as the body. Without it the
    // same bytes arrive as a file to download and the calendar does nothing —
    // which is the bug this file exists to fix, in its other form.
    contentType: icalContentType(method),
  };
}
