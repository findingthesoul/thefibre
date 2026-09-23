// The tickets this device keeps, so a door works with no signal.
//
// Sjoerd, 2026-09-23: "tickets may be kept on devices." Until that decision
// the service worker cached no personal data at all; this is the one exception
// and it is deliberately the SMALLEST one that answers the question.
//
// ── What is kept, and what is not ──────────────────────────────────────────
//
// Four fields per ticket: the check-in code, what it is for, when, and where.
// Enough to find the right ticket in a queue and show it. NOT the agenda, not
// the RSVP, not memberships, not invoices, not the person — none of which a
// door asks for, and all of which would be a copy of somebody's life sitting
// on a phone to no purpose.
//
// ── Where, and why not IndexedDB ───────────────────────────────────────────
//
// localStorage, because /offline.html is a static file with no bundle: it has
// to read this synchronously with about six lines of script. The whole payload
// is a few hundred bytes.
//
// ── Sign-out ───────────────────────────────────────────────────────────────
//
// `forgetTickets()` runs on sign-out, before the redirect. Data kept for
// convenience must not outlive the session that justified it — that is the
// rule the service worker follows for pages, and the reason it refuses to
// cache them.

const KEY = 'my.tickets.v1';

export type KeptTicket = {
  /** The QR the door scans. Also the id: one ticket per code. */
  code: string;
  title: string;
  /** ISO date or datetime; may be null for a thread with no date yet. */
  startsAt: string | null;
  where: string | null;
};

export function readKeptTickets(): KeptTicket[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Shape-checked rather than trusted: this is browser storage, which a
    // person, an extension or an older version of this app can have written.
    return parsed.filter(
      (t): t is KeptTicket =>
        !!t && typeof (t as KeptTicket).code === 'string' && typeof (t as KeptTicket).title === 'string',
    );
  } catch {
    return [];
  }
}

/** Replace the kept set. Replace, not merge — a ticket that disappears from
 *  the portal (cancelled, refunded, moved) must disappear from the phone. */
export function keepTickets(tickets: KeptTicket[]): void {
  try {
    if (tickets.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(tickets));
  } catch {
    // A full or disabled store is not worth breaking the page for.
  }
}

export function forgetTickets(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
