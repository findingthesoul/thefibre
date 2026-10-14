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
 * Does this agenda item ask who is coming?
 *
 * THREE levels, each NULL meaning "inherit" rather than "off": the item, then
 * its thread, then the workspace default, then yes. Sjoerd moved the operative
 * control to the item on 2026-09-09 — a residential weekend needs a headcount
 * and the reading group before it does not — without removing the thread
 * level, which is deployed and is a real thing to want.
 *
 * ONE resolver because the rule had already forked: the portal's read side
 * resolved it batched across a page of items, its write side resolved it again
 * per request, and the organiser's panel needed it a third time. Two of those
 * disagreeing is silent in the worst way — the participant's control vanishes
 * and the endpoint still accepts, or the control shows and every answer 409s.
 * Neither surfaces to the organiser, who sees a switch that looked like it
 * worked.
 *
 * `hasStart` is here rather than at the call sites for the same reason: only a
 * timed item can be attended, so only a timed item can be asked about, and
 * that is one condition rather than a parallel test in three places.
 */
export function resolveRsvpEnabled(input: {
  /** thread_engagement.rsvp_enabled. Anything but an explicit true is off. */
  item: boolean | null | undefined;
  /** Whether the item has a start time. */
  hasStart: boolean;
}): boolean {
  // ONE PLACE, DEFAULT OFF (Sjoerd, 2026-09-09): "bring it back to one place:
  // per event. Be default off — i.e. not visible for participants. If someone
  // wants all their events to RSVP, they can toggle it, or duplicate an event
  // for the rest of the thread."
  //
  // This replaced a three-level inheritance chain — item → thread → workspace
  // default → true — that was correct for the requirement it was built for
  // and outlived it by an hour. Two properties of the old rule are worth
  // knowing about because they are exactly what the new one refuses:
  //
  //   Asking was the DEFAULT. Every dated item on every thread asked every
  //   participant, unless someone turned it off in a column with no UI. The
  //   feature arrived switched on for everybody, which is the opposite of a
  //   question you choose to ask.
  //
  //   Off was reachable from three levels, so "why is this item not asking?"
  //   had three possible answers and two of them were invisible.
  //
  // `thread_thread.rsvp_enabled` and `thread_settings.rsvp_default_enabled`
  // still EXIST — dropping a column is destructive and buys nothing — but
  // nothing reads them and the API no longer accepts writes to them. If you
  // are here to re-wire one, that is a product decision, not a repair.
  return input.hasStart && input.item === true;
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

// ---------------------------------------------------------------------------
// WHAT SOMEBODY BOUGHT, GROUPED BY COMMUNITY.
//
// Pure, and out here rather than inline in the route, because the rules are
// small and each of them is a decision somebody will want to check:
//
//   · It is keyed on the PERSON. Until 2026-10-14 the purchase list was built
//     inside the membership loop and filtered to the workspaces the person
//     held a membership in — so somebody who bought a product from a
//     community they had never joined owned it, was granted access by it, and
//     could see no sign of it anywhere.
//   · NEWEST FIRST, preserved from the caller's order rather than re-sorted,
//     because the most recent purchase is the one somebody is looking for.
//   · ONE ROW PER PRODUCT. Buying the same product twice is a real thing
//     (a second seat, a repeat year) and the LIST is not where that belongs —
//     "What you paid" has every payment, with its own date and amount. Two
//     identical lines here read as a bug.
// ---------------------------------------------------------------------------

/** A purchase row, as little of it as the grouping needs. */
export type BoughtRow = { workspace_id: string; product_id: string; created_at: string };

/** Group a person's purchases by workspace, resolving each to something
 *  showable. `resolve` returns null for a product that cannot be named — an
 *  archived row, or one in a workspace this reader cannot see — and those are
 *  dropped rather than shown as a blank line. */
export function groupOwnedProducts<T extends object>(
  rows: BoughtRow[],
  resolve: (productId: string, workspaceId: string) => T | null,
): Map<string, (T & { bought_on: string })[]> {
  const out = new Map<string, (T & { bought_on: string })[]>();
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.workspace_id}|${r.product_id}`;
    if (seen.has(key)) continue;
    const resolved = resolve(r.product_id, r.workspace_id);
    if (!resolved) continue;
    seen.add(key);
    out.set(r.workspace_id, [
      ...(out.get(r.workspace_id) ?? []),
      { ...resolved, bought_on: r.created_at },
    ]);
  }
  return out;
}
