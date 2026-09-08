// The visitor portal's two pieces of judgement, extracted pure so they can
// be locked by tests. Everything else in routes/portal.ts is querying and
// shaping; these two are decisions.

/**
 * Does this enrolment carry a QR the door will actually honour?
 *
 * A ticket the door refuses is worse than no ticket at all: the holder
 * queues, presents it, and is turned away in front of the queue. So an
 * unpaid or declined enrolment still appears on the page as a thread — it
 * just doesn't get a QR.
 *
 * `paymentStatus` null means the thread never asked for money (free), which
 * admits. The paid-ish states mirror thread_enrolment.payment_status:
 * 'invoice_sent' admits because the organiser chose to invoice this person
 * and let them in on that basis.
 */
export function ticketIsAdmissible(
  enrolmentStatus: string | null,
  paymentStatus: string | null,
): boolean {
  if (enrolmentStatus === 'dropped') return false;
  if (paymentStatus === null) return true;
  return ['paid', 'not_required', 'invoice_sent'].includes(paymentStatus);
}

/**
 * Merge rows fetched under two different keys, keeping one copy each.
 *
 * Rows that predate a person id carry only an email; rows an organiser
 * entered by hand may carry only a person id. Finding all of someone's rows
 * needs both queries — and a row that matches BOTH would otherwise appear
 * twice. Verified against real data: a Meet booking with an invitee_person_id
 * AND a matching invitee_email is returned by both queries.
 *
 * First occurrence wins; the caller passes the more authoritative list first.
 */
export function mergeById<T extends { id: string }>(...lists: (T[] | null | undefined)[]): T[] {
  const byId = new Map<string, T>();
  for (const list of lists) {
    for (const row of list ?? []) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}
