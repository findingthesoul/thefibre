// One list, ordered by date. The flattening happens HERE, in the page,
// rather than in the API (docs/member-portal-plan.md §9): everything is
// already fetched in one call, one member has few entries, and nobody yet
// knows whether filtering by organiser is a real need or something that
// merely sounded right. Move it server-side when a real member's list is
// long enough to hurt, not before.

import type { AgendaItem, Portal, RsvpResponse } from './portal-api';
import { INTL_LOCALES, toLocale, type Locale } from '@thefibre/shared/i18n';
import { DEFAULT_TZ, fmtTime, intlTag } from './format';
import { t } from './i18n';

export type Entry = {
  key: string;
  /**
   * What this row IS. Everything was a session until 2026-09-25; a
   * certificate is the first entry that is not something you attend, and it
   * behaves differently for it — no RSVP to give, no room to join, and a
   * thumbnail rather than a time.
   *
   * A field rather than a separate list, because the whole premise of this
   * page is one column in date order. A certificate arriving on the day you
   * finished belongs next to the session that finished it, not in a drawer
   * labelled Certificates that nobody opens.
   */
  kind: 'session' | 'certificate';
  /** The instant this sorts at. All-day things sort at the START of their
   *  day — the convention every calendar uses, and the reason is that "the
   *  whole day" does begin before the 16:00 call. */
  at: number;
  /** True when the source carried a DAY and no clock. The two kinds must
   *  sort against each other by one deliberate rule or the same list orders
   *  differently on different days. */
  allDay: boolean;
  title: string;
  organiser: string;
  workspaceId: string;
  /** ISO of the date, for the chip. */
  dateIso: string;
  /** "16:00" in `timeZone`, or null for an all-day entry. */
  time: string | null;
  /** The zone the session happens in — the thread's, else the platform
   *  default. Its clock is formatted in this zone on the server and in the
   *  browser alike, so the list and the dialog can never disagree again. */
  timeZone: string;
  /** The zone to read `dateIso`'s DAY in: the session's for a timed entry;
   *  UTC for an all-day one, whose date-only value is UTC midnight. */
  dayZone: string;
  where: string | null;
  /** A meet with no location says who it is with instead — the NAME only;
   *  the words around it are the reader's language, added where it renders. */
  withHost?: string | null;
  /** A map link for `where`, when there is one. */
  whereUrl: string | null;
  /** Offered only inside the window below — a Join button three months early
   *  is clutter pretending to be an action. */
  joinUrl: string | null;
  /** The thread whose sheet this card opens. Null for a meet, which has no
   *  sheet of its own. */
  threadId: string | null;
  /** The agenda item, when this entry IS one — what the RSVP writes to. */
  engagementId: string | null;
  rsvpEnabled: boolean;
  rsvp: RsvpResponse | null;
  hasTicket: boolean;
  /** A thread with no dated session yet, shown at its start date (Sjoerd,
   *  2026-10-17: it read as a session on that day). The row says "Starts …"
   *  instead of a time; it stays, because it is the only way into the
   *  thread's dialog — the ticket, a cancellation, the full page. */
  startsOnly?: boolean;
  /** No dated session AND no start date: the thread is all there is to say
   *  (2026-10-17 — such a thread was dropped, and Next said "Nothing coming
   *  up" to somebody holding a place). `at` is UNDATED_AT, so it is always
   *  upcoming and sorts last; `dateIso` is '' and must never be formatted —
   *  `startsLine` is the one reader. Always `startsOnly` too: it lives in the
   *  coming-soon section, "Date to follow". */
  undated?: boolean;
  /** You host or facilitate this session — "You're hosting", not a
   *  participant's line. */
  role?: 'host' | 'facilitator' | null;
};

/** Where an undated entry sits in time: the LAST moment a Date can hold
 *  (8.64e15 ms, year 275760), not Infinity. Entries cross from the server page
 *  to a client component, and Infinity does not survive every serialiser (JSON
 *  makes it null); this is finite, sorts after every real date, and is always
 *  "upcoming". It is never a date to show — see `startsLine`. */
export const UNDATED_AT = 8.64e15;

/** "13 Jan" — a date-only value (UTC midnight), read in UTC. */
export function shortDay(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(intlTag(locale), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso));
}

/** The line a thread-without-sessions shows instead of a time: "Starts 13 Jan",
 *  or "Date to follow" when there is no date at all. The ONE place that turns
 *  such an entry's date into words — an undated entry's `dateIso` is '', and
 *  formatting it would throw (Invalid Date). */
export function startsLine(e: Pick<Entry, 'undated' | 'dateIso'>, locale: string): string {
  return e.undated ? t(locale, 'date_to_follow') : t(locale, 'starts_on_date', { date: shortDay(e.dateIso, locale) });
}

/** A day with no clock, read in the viewer's own timezone. `new Date('2027-01-01')`
 *  is UTC midnight, which lands on the previous day west of Greenwich. */
function startOfDay(dateOnly: string): number {
  return new Date(`${dateOnly.slice(0, 10)}T00:00:00`).getTime();
}

function hhmm(iso: string, tz: string): string {
  // en-GB: the 24-hour clock this list has always shown, in every language.
  return fmtTime(iso, 'en', tz);
}

/** From 15 minutes before it starts until it ends (or two hours in, when
 *  nothing says when it ends). Before that there is nothing to join; long
 *  after, the link is a distraction. */
function joinable(startsAt: string, endsAt: string | null, now: number): boolean {
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : start + 2 * 60 * 60 * 1000;
  return now >= start - 15 * 60 * 1000 && now <= end;
}

export function buildTimeline(portal: Portal, now = Date.now()): Entry[] {
  const out: Entry[] = [];

  for (const g of portal.groups) {
    const ticketFor = new Map(g.tickets.map((t) => [t.thread_id, t]));

    for (const t of g.threads) {
      const tz = t.timezone || DEFAULT_TZ;
      const timed = t.agenda.filter((a) => a.starts_at);

      // A thread with sessions contributes its SESSIONS: they are what you
      // attend. The thread itself is the container, and a container has no
      // place in a list of things that happen.
      for (const a of timed) {
        const startsAt = a.starts_at!;
        out.push({
          key: `agenda:${a.id}`,
          kind: 'session',
          at: new Date(startsAt).getTime(),
          allDay: false,
          title: a.title,
          organiser: g.name,
          workspaceId: g.workspace_id,
          dateIso: startsAt,
          time: hhmm(startsAt, tz),
          timeZone: tz,
          dayZone: tz,
          where: a.location ?? null,
          whereUrl: a.location_url ?? null,
          joinUrl: a.meeting_url && joinable(startsAt, a.ends_at, now) ? a.meeting_url : null,
          threadId: t.thread_id,
          engagementId: a.id,
          rsvpEnabled: a.rsvp_enabled,
          rsvp: a.rsvp,
          hasTicket: ticketFor.has(t.thread_id),
          role: a.my_role ?? null,
        });
      }

      // No dated session: the thread's own start date is the only date there
      // is, and a thread you are enrolled in with nothing scheduled still
      // has to be reachable.
      // (Not for a thread you only HOST: you are on its sessions, and with
      // none ticked there is nothing of yours to show.)
      // No sessions AND no start date: nothing to place it by, so it goes to
      // the coming-soon section undated — but only while it is still ahead of
      // you. A dated thread falls into the past by itself; an undated one
      // never would, so "over" is read from what is known instead: a
      // certificate, a place that is completed or dropped, a programme that
      // is completed or archived.
      const over =
        !!t.certificate ||
        t.enrolment_status === 'completed' ||
        t.enrolment_status === 'dropped' ||
        t.status === 'completed' ||
        t.status === 'archived';
      if (timed.length === 0 && !t.starts_on && !over && !(t.my_role && !t.enrolment_status)) {
        out.push({
          key: `thread:${t.thread_id}`,
          kind: 'session',
          at: UNDATED_AT,
          allDay: true,
          title: t.title,
          organiser: g.name,
          workspaceId: g.workspace_id,
          dateIso: '',
          time: null,
          timeZone: tz,
          dayZone: 'UTC',
          startsOnly: true,
          undated: true,
          where: null,
          whereUrl: null,
          joinUrl: null,
          threadId: t.thread_id,
          engagementId: null,
          rsvpEnabled: false,
          rsvp: null,
          hasTicket: ticketFor.has(t.thread_id),
        });
      } else if (timed.length === 0 && t.starts_on && !(t.my_role && !t.enrolment_status)) {
        out.push({
          key: `thread:${t.thread_id}`,
          kind: 'session',
          at: startOfDay(t.starts_on),
          allDay: true,
          title: t.title,
          organiser: g.name,
          workspaceId: g.workspace_id,
          dateIso: t.starts_on,
          time: null,
          timeZone: tz,
          dayZone: 'UTC',
          startsOnly: true,
          where: null,
          whereUrl: null,
          joinUrl: null,
          threadId: t.thread_id,
          engagementId: null,
          rsvpEnabled: false,
          rsvp: null,
          hasTicket: ticketFor.has(t.thread_id),
        });
      }

      // The certificate, on the day it was issued.
      //
      // Always an entry of its own, even on a thread with sessions — it is
      // not something you attended, it is what you were left with, and it is
      // the one thing people come back to this page for months later. The
      // comment on `splitAt` below said so before this existed: past is
      // looked at "usually for a certificate or a receipt".
      //
      // All-day, deliberately: a certificate issued at 14:32 tells the
      // holder nothing, and a clock in that chip would be the organiser's
      // working moment shown as if it were an appointment.
      if (t.certificate) {
        out.push({
          key: `cert:${t.certificate.number}`,
          kind: 'certificate',
          at: startOfDay(t.certificate.issued_at),
          allDay: true,
          title: t.title,
          organiser: g.name,
          workspaceId: g.workspace_id,
          dateIso: t.certificate.issued_at,
          time: null,
          timeZone: tz,
          dayZone: 'UTC',
          where: null,
          whereUrl: null,
          joinUrl: null,
          threadId: t.thread_id,
          engagementId: null,
          rsvpEnabled: false,
          rsvp: null,
          hasTicket: false,
        });
      }
    }

    for (const m of g.meets) {
      out.push({
        key: `meet:${m.booking_id}`,
        kind: 'session',
        at: new Date(m.starts_at).getTime(),
        allDay: false,
        title: m.title,
        organiser: g.name,
        workspaceId: g.workspace_id,
        dateIso: m.starts_at,
        // The booking's own zone (API v1.267.3); the platform default when an
        // older API sends none — never the server's.
        time: hhmm(m.starts_at, m.timezone || DEFAULT_TZ),
        timeZone: m.timezone || DEFAULT_TZ,
        dayZone: m.timezone || DEFAULT_TZ,
        where: m.location ?? null,
        withHost: m.location ? null : (m.host ?? null),
        whereUrl: null,
        joinUrl: m.meet_url && joinable(m.starts_at, m.ends_at, now) ? m.meet_url : null,
        threadId: null,
        engagementId: null,
        rsvpEnabled: false,
        rsvp: null,
        hasTicket: false,
      });
    }
  }

  return out.sort((a, b) => a.at - b.at);
}

const DAY = 24 * 60 * 60 * 1000;
/** How long a timed entry stays on the list after it starts. Something
 *  happening RIGHT NOW is the most useful thing the page can show, and it
 *  would otherwise drop off the moment it began. */
const IN_PROGRESS = 2 * 60 * 60 * 1000;

/** Past is behind a toggle, not a fifth destination: it is looked at rarely
 *  and briefly, usually for a certificate or a receipt. An all-day entry is
 *  past only once its whole day is over; a timed one only once it has had
 *  time to finish. Past runs newest first — you look backwards from now. */
export function splitAt(
  entries: Entry[],
  now = Date.now(),
): { upcoming: Entry[]; past: Entry[] } {
  const over = (e: Entry) => (e.allDay ? e.at + DAY : e.at + IN_PROGRESS) < now;
  return {
    upcoming: entries.filter((e) => !over(e)),
    past: entries.filter(over).reverse(),
  };
}

/** The quarter an entry falls in, as something a member would say out loud.
 *
 *  Sjoerd asked to "organise your timeline per quarter". Grouping, not
 *  filtering: it costs no control, nothing to tap and nothing to reset, and
 *  it makes a long list scannable without adding a row of chrome above a
 *  short one. "Q4 2026" is a finance word; a member reads months.
 */
export function quarterLabel(at: number, locale?: Locale | string | null): string {
  const d = new Date(at);
  const q = Math.floor(d.getMonth() / 3);
  const l = toLocale(locale ?? null);
  // Another language names its own months. English keeps the table below:
  // en-GB's short September is "Sept", and "Jul–Sept" is not what this
  // label has always said.
  if (l !== 'en') {
    const month = (m: number) =>
      new Intl.DateTimeFormat(INTL_LOCALES[l], { month: 'short' }).format(new Date(d.getFullYear(), m, 15));
    return `${month(q * 3)}\u2013${month(q * 3 + 2)} ${d.getFullYear()}`;
  }
  const months = [
    ['Jan', 'Mar'],
    ['Apr', 'Jun'],
    ['Jul', 'Sep'],
    ['Oct', 'Dec'],
  ][q]!;
  return `${months[0]}\u2013${months[1]} ${d.getFullYear()}`;
}

/** Entries that ask a question this person has not answered.
 *
 *  The other filters answer "show me a subset". This one answers "what have
 *  I not dealt with", which is a to-do rather than a view — so it surfaces as
 *  a COUNT that appears when it is non-zero, not as a chip sitting there
 *  forever. A filter you have to think to use does not get used; a number
 *  that shows up when it means something does.
 */
export function unanswered(entries: Entry[]): Entry[] {
  return entries.filter((e) => e.rsvpEnabled && e.rsvp === null);
}

/** The agenda in time order (Sjoerd, 2026-10-17: a 12 Jan event listed after
 *  17 Feb). The API sends the organiser's editor order across all types;
 *  dated items are sorted by start here, and undated ones (a message, a
 *  document) follow in that editor order. Client only: the API's order is a
 *  contract other readers rely on. */
export function agendaByStart(items: AgendaItem[]): AgendaItem[] {
  const dated = items.filter((a) => a.starts_at).sort((x, y) => Date.parse(x.starts_at!) - Date.parse(y.starts_at!));
  return [...dated, ...items.filter((a) => !a.starts_at)];
}
