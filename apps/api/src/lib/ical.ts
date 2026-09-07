// Minimal iCalendar (RFC 5545) generator — one VEVENT, hand-rolled.
// Ported from Soul Suite; a library would be more machinery than the job.
//
// Line folding: RFC 5545 folds at 75 octets. Our fields (a meeting name, a
// short description, two emails, one URL) stay well inside that, and every
// consumer we care about tolerates long lines, so we don't fold.

export interface IcalEventInput {
  uid: string; // stable per booking — re-issuing updates rather than duplicates
  startsAt: Date;
  endsAt: Date;
  summary: string;
  description?: string | null;
  location?: string | null;
  organizerName: string;
  organizerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
  status?: 'CONFIRMED' | 'CANCELLED';
  /** Bumped on every reschedule so calendars accept the update. */
  sequence?: number;
  generatedAt?: Date;
}

export function buildBookingIcal(args: IcalEventInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Fibre//Meet//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${args.uid}`,
    `DTSTAMP:${formatUtc(args.generatedAt ?? new Date())}`,
    `DTSTART:${formatUtc(args.startsAt)}`,
    `DTEND:${formatUtc(args.endsAt)}`,
    `SEQUENCE:${args.sequence ?? 0}`,
    `SUMMARY:${escapeText(args.summary)}`,
    args.description ? `DESCRIPTION:${escapeText(args.description)}` : null,
    args.location ? `LOCATION:${escapeText(args.location)}` : null,
    `ORGANIZER;CN=${escapeParam(args.organizerName)}:mailto:${args.organizerEmail}`,
    `ATTENDEE;CN=${escapeParam(args.attendeeName)};RSVP=FALSE:mailto:${args.attendeeEmail}`,
    `STATUS:${args.status ?? 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((l): l is string => l !== null);

  return lines.join('\r\n') + '\r\n';
}

/** YYYYMMDDTHHMMSSZ */
function formatUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** RFC 5545 §3.3.11 — escape backslash, semicolon, comma, newline. */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Parameter values can't carry quotes/semicolons/colons/commas unquoted. */
function escapeParam(s: string): string {
  return s.replace(/[";:,]/g, ' ').replace(/\s+/g, ' ').trim();
}
