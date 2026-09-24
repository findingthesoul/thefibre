// Minimal iCalendar (RFC 5545) generator — one VEVENT, hand-rolled.
// Ported from Soul Suite; a library would be more machinery than the job.
//
// Lives in @thefibre/shared, not in the API, because more than one thing
// needs it and it is a pure string builder: no dependencies, no node, no
// personal data of its own. Same rule the invoice model follows (v0.68.26)
// — the DEFINITION is shared, renderers that need an engine are not.
// Meet renders it server-side; the visitor portal renders its own for a
// thread agenda item.
//
// Line folding: RFC 5545 folds at 75 octets. Our fields (a meeting name, a
// short description, two emails, one URL) stay well inside that, and every
// consumer we care about tolerates long lines, so we don't fold.

/**
 * An agenda item with a start but no end: an hour is the least surprising
 * guess, and a calendar entry with no duration renders inconsistently across
 * clients (some collapse it to a marker, some stretch it to the day).
 */
export const DEFAULT_EVENT_MINUTES = 60;

/**
 * The calendar identity of one thread agenda item.
 *
 * Shared because it is the hinge two features turn on. The portal offers the
 * same session twice — as a single "Add to calendar" download, and inside the
 * subscription feed — and a person may well use both. Same uid means the
 * second one UPDATES the first; a different uid means they end up with two of
 * everything and no way to tell which is current. So neither side gets to
 * spell this itself.
 */
export function agendaEventUid(agendaItemId: string): string {
  return `agenda-${agendaItemId}@thefibre`;
}

export interface IcalEventInput {
  uid: string; // stable per booking — re-issuing updates rather than duplicates
  startsAt: Date;
  endsAt: Date;
  summary: string;
  description?: string | null;
  location?: string | null;
  /** Omitted for events with no single host — the agenda item of a thread. */
  organizerName?: string | null;
  organizerEmail?: string | null;
  /** Omitted when the file is a download rather than an invitation. */
  attendeeName?: string | null;
  attendeeEmail?: string | null;
  /** Defaults to Meet's, for byte-compatibility with what it already sends. */
  prodId?: string;
  /** A link carried into the calendar entry (join link, thread page). */
  url?: string | null;
  status?: 'CONFIRMED' | 'CANCELLED';
  /** Bumped on every reschedule so calendars accept the update. */
  sequence?: number;
  generatedAt?: Date;
}

export function buildBookingIcal(args: IcalEventInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${args.prodId ?? '-//The Fibre//Meet//EN'}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...veventLines(args),
    'END:VCALENDAR',
  ];

  return lines.join('\r\n') + '\r\n';
}

/**
 * A subscribable calendar: many events in one document, re-fetched by the
 * client on its own schedule.
 *
 * The difference from buildBookingIcal is not the number of events — it is
 * what the document MEANS. A one-off .ics is a copy handed over once; from
 * then on the calendar owns it and a change on our side never reaches it. A
 * feed is the live answer: the client re-reads it, and whatever it says now
 * wins. So a moved session moves, and a cancelled one disappears, without the
 * person doing anything.
 *
 * That only works if UIDs are STABLE across fetches. Same agenda item, same
 * uid, every time — otherwise each fetch reads as a fresh event and the
 * person collects duplicates instead of corrections. The uid is the caller's
 * to get right, because only the caller knows what the durable identity is.
 *
 * Deletion is by absence: an event that stops appearing in the feed is gone.
 * There is no tombstone to emit, which is why an event the person should no
 * longer see must be OMITTED rather than marked cancelled.
 */
export interface IcalFeedInput {
  /** What the calendar is called in the sidebar once subscribed. */
  name: string;
  description?: string | null;
  prodId?: string;
  /** How often a well-behaved client should re-read. Advisory: Google and
   *  Apple both apply their own floor (hours, not minutes) and ignore this
   *  when it suits them. We state an intent, we do not get a guarantee. */
  refreshMinutes?: number;
  events: IcalEventInput[];
  generatedAt?: Date;
}

export function buildCalendarFeed(args: IcalFeedInput): string {
  const refresh = durationMinutes(args.refreshMinutes ?? 240);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${args.prodId ?? '-//The Fibre//Portal//EN'}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // Two spellings of the same wish. REFRESH-INTERVAL is RFC 7986; the
    // X- forms are what shipped first and what several clients still read.
    `REFRESH-INTERVAL;VALUE=DURATION:${refresh}`,
    `X-PUBLISHED-TTL:${refresh}`,
    `NAME:${escapeText(args.name)}`,
    `X-WR-CALNAME:${escapeText(args.name)}`,
    args.description ? `DESCRIPTION:${escapeText(args.description)}` : null,
    args.description ? `X-WR-CALDESC:${escapeText(args.description)}` : null,
    // The feed's stamp applies to every event that did not bring its own,
    // so two fetches of an unchanged calendar are byte-identical.
    ...args.events.flatMap((e) =>
      veventLines(e.generatedAt || !args.generatedAt ? e : { ...e, generatedAt: args.generatedAt }),
    ),
    'END:VCALENDAR',
  ].filter((l): l is string => l !== null);

  return lines.join('\r\n') + '\r\n';
}

/** The VEVENT block, shared by the single file and the feed so the two can
 *  never disagree about what one event looks like. */
function veventLines(args: IcalEventInput): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${args.uid}`,
    `DTSTAMP:${formatUtc(args.generatedAt ?? new Date())}`,
    `DTSTART:${formatUtc(args.startsAt)}`,
    `DTEND:${formatUtc(args.endsAt)}`,
    `SEQUENCE:${args.sequence ?? 0}`,
    `SUMMARY:${escapeText(args.summary)}`,
    args.description ? `DESCRIPTION:${escapeText(args.description)}` : null,
    args.location ? `LOCATION:${escapeText(args.location)}` : null,
    args.url ? `URL:${escapeText(args.url)}` : null,
    args.organizerEmail
      ? `ORGANIZER;CN=${escapeParam(args.organizerName ?? args.organizerEmail)}:mailto:${args.organizerEmail}`
      : null,
    args.attendeeEmail
      ? `ATTENDEE;CN=${escapeParam(args.attendeeName ?? args.attendeeEmail)};RSVP=FALSE:mailto:${args.attendeeEmail}`
      : null,
    `STATUS:${args.status ?? 'CONFIRMED'}`,
    'END:VEVENT',
  ].filter((l): l is string => l !== null);
}

/** Minutes as an RFC 5545 duration, in the largest whole unit that fits —
 *  PT4H rather than PT240M, because a human reads the header too. */
function durationMinutes(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  if (m % 1440 === 0) return `P${m / 1440}D`;
  if (m % 60 === 0) return `PT${m / 60}H`;
  return `PT${m}M`;
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

/**
 * The title a calendar entry carries: the meeting's name, then the person on
 * the OTHER side of it.
 *
 * A host's week is otherwise a column of identical "Intro call" blocks, and an
 * invitee's is a meeting with nobody named. So each side names its counterpart
 * — the host's copy says the invitee, the invitee's copy says the host
 * (Sjoerd, 2026-09-24). Which name to pass is the caller's decision, because
 * only the caller knows whose calendar the entry is going onto.
 *
 * With no counterpart to name, the meeting's own name stands alone rather than
 * trailing a separator.
 */
export function bookingCalendarTitle(
  meetingName: string,
  counterpartName?: string | null,
): string {
  const other = counterpartName?.trim();
  return other ? `${meetingName} - ${other}` : meetingName;
}
