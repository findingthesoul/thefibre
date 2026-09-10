// One list, ordered by date. The flattening happens HERE, in the page,
// rather than in the API (docs/member-portal-plan.md §9): everything is
// already fetched in one call, one member has few entries, and nobody yet
// knows whether filtering by organiser is a real need or something that
// merely sounded right. Move it server-side when a real member's list is
// long enough to hurt, not before.

import type { Portal, RsvpResponse } from './portal-api';

export type Entry = {
  key: string;
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
  /** "16:00", or null for an all-day entry. */
  time: string | null;
  where: string | null;
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
};

/** A day with no clock, read in the viewer's own timezone. `new Date('2027-01-01')`
 *  is UTC midnight, which lands on the previous day west of Greenwich. */
function startOfDay(dateOnly: string): number {
  return new Date(`${dateOnly.slice(0, 10)}T00:00:00`).getTime();
}

function hhmm(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
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
      const timed = t.agenda.filter((a) => a.starts_at);

      // A thread with sessions contributes its SESSIONS: they are what you
      // attend. The thread itself is the container, and a container has no
      // place in a list of things that happen.
      for (const a of timed) {
        const startsAt = a.starts_at!;
        out.push({
          key: `agenda:${a.id}`,
          at: new Date(startsAt).getTime(),
          allDay: false,
          title: a.title,
          organiser: g.name,
          workspaceId: g.workspace_id,
          dateIso: startsAt,
          time: hhmm(startsAt),
          where: a.location ?? null,
          whereUrl: a.location_url ?? null,
          joinUrl: a.meeting_url && joinable(startsAt, a.ends_at, now) ? a.meeting_url : null,
          threadId: t.thread_id,
          engagementId: a.id,
          rsvpEnabled: a.rsvp_enabled,
          rsvp: a.rsvp,
          hasTicket: ticketFor.has(t.thread_id),
        });
      }

      // No dated session: the thread's own start date is the only date there
      // is, and a thread you are enrolled in with nothing scheduled still
      // has to be reachable.
      if (timed.length === 0 && t.starts_on) {
        out.push({
          key: `thread:${t.thread_id}`,
          at: startOfDay(t.starts_on),
          allDay: true,
          title: t.title,
          organiser: g.name,
          workspaceId: g.workspace_id,
          dateIso: t.starts_on,
          time: null,
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
    }

    for (const m of g.meets) {
      out.push({
        key: `meet:${m.booking_id}`,
        at: new Date(m.starts_at).getTime(),
        allDay: false,
        title: m.title,
        organiser: g.name,
        workspaceId: g.workspace_id,
        dateIso: m.starts_at,
        time: hhmm(m.starts_at),
        where: m.location ?? (m.host ? `with ${m.host}` : null),
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
export function quarterLabel(at: number): string {
  const d = new Date(at);
  const q = Math.floor(d.getMonth() / 3);
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
