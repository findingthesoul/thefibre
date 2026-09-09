// The visitor portal's two pieces of judgement, extracted pure so they can
// be locked by tests. Everything else in routes/portal.ts is querying and
// shaping; these two are decisions.

/**
 * Is this person still a participant at all, as opposed to someone with a
 * record of having taken part?
 *
 * THE ONE FACT the door and the RSVP agree on, extracted so it is written
 * once. Both predicates below start here and then diverge; before this
 * existed the literal `'dropped'` was hand-copied into both, ten lines
 * apart, in the file whose whole point is that they agree on exactly this.
 * The day someone adds 'withdrawn' or 'removed', one copy gets updated and
 * the other does not — and the silent direction is the bad one: a person who
 * should not be answering, answering. (Caught by the membership session,
 * 2026-09-09, reviewing the fix that introduced the second copy.)
 */
export function enrolmentIsLive(enrolmentStatus: string | null): boolean {
  return enrolmentStatus !== 'dropped';
}

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
  if (!enrolmentIsLive(enrolmentStatus)) return false;
  if (paymentStatus === null) return true;
  return ['paid', 'not_required', 'invoice_sent'].includes(paymentStatus);
}

/**
 * May this person still act as a participant of the thread — RSVP, in
 * practice — or are they only looking at a record of having taken part?
 *
 * Separate from `ticketIsAdmissible`, and it must STAY separate. The weak
 * reason is that a door also asks whether the money landed, where an RSVP is
 * not a purchase — an unpaid participant saying "I'm coming" costs nothing
 * and is worth knowing. The strong reason is that these two will diverge
 * again, predictably, on statuses neither has been asked about yet:
 *
 *   'completed'     admissible to the session that happened; should almost
 *                   certainly NOT be answering for future ones.
 *   'invoice_sent'  admitted on trust at a door; an invoice six weeks old is
 *                   a different question for an RSVP than for entry.
 *
 * One predicate would force both through a shape that cannot express them,
 * and whoever hit it would add a boolean parameter rather than split the
 * function again. `portal.test.ts` asserts the divergence on purpose so a
 * later reader does not merge them thinking it is a tidy-up.
 *
 * Reachable since v0.68.31: the membership thread worker sets an enrolment
 * to 'dropped' as a membership lapses — soft delete, so the rows stay and
 * the person keeps seeing the thread. They stop answering for its future
 * sessions.
 */
export function enrolmentCanRespond(enrolmentStatus: string | null): boolean {
  return enrolmentIsLive(enrolmentStatus);
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
