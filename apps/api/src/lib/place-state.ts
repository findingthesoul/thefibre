// What a person's EXISTING place on a thread means for signing up again —
// one decision, for the enrol route and for every list that offers "Join".
//
// Until 2026-10-14 the route decided inline and the lists decided "has a row
// = already in", and the two disagreed in both directions: a list could offer
// a join the route answered `already_enrolled`, and a list could hide a place
// the route would happily reopen. Two answers to one question about money is
// the bug this file exists to make impossible: both sides call these three
// functions and nothing else.
//
// The four states, in the order they win:
//
//   closed       — the place was ended by somebody else: enrolment status
//                  `dropped`, which today is an organiser's DECLINE or a
//                  membership-granted place withdrawn on a lapse. Held, and
//                  never offered again from a list: a declined person who
//                  could simply re-apply would have to be declined again on
//                  every approval thread. The route says so (`place_closed`,
//                  with `place_closed_reason`). Wins over an open invoice:
//                  telling a declined person about their invoice reads as an
//                  invitation to pay for a place that is closed.
//                  (Rejoining after cancelling YOURSELF was approved by Sjoerd
//                  on 2026-10-14, but no self-cancel exists yet, and reopening
//                  a place without rewriting its ledger reference needs a
//                  schema change: one place per person per thread is unique
//                  twice over. Deferred, not forgotten.)
//   invoice_open — unpaid, and the ledger holds an INVOICE for it. Held. An
//                  invoice is a numbered legal document and nothing voids it
//                  when a card payment lands, so offering "Join" by card here
//                  is how a person pays twice. Wins over a failed card attempt
//                  that came before the invoice.
//   retry        — unpaid by card (payment `pending` or `failed`, no invoice):
//                  a bailed or expired checkout. The route reuses the row and
//                  runs the payment again — never a dead end.
//   held         — anything else: a live, paid, free or finished place.

import { adminClient } from '../db.js';

export type PlaceState = 'held' | 'retry' | 'invoice_open' | 'closed';

export type PlaceFacts = {
  /** enrolment.status — the platform row. */
  enrolmentStatus: string | null;
  /** thread_enrolment.payment_status. */
  paymentStatus: string | null;
  /** Does the ledger hold an invoice for this place (purchase.method)? */
  invoiced: boolean;
};

export function placeState(p: PlaceFacts): PlaceState {
  const unpaid = p.paymentStatus === 'pending' || p.paymentStatus === 'failed';
  // Closed FIRST: a person the organiser declined, who still has an invoice
  // open, must not be told about the invoice — that reads as an invitation
  // to pay for a place that is closed. (Coordinator review of v1.193.0.)
  if (p.enrolmentStatus === 'dropped') return 'closed';
  if (unpaid && p.invoiced) return 'invoice_open';
  if (unpaid) return 'retry';
  return 'held';
}

/** What POST /thread/public/enrol does with an existing place.
 *
 *  `requiresPayment` is the route's own: the final price after code and
 *  member discount is above zero. A card retry on something that now costs
 *  nothing is simply a place already held. */
export type DuplicateAnswer = 'reuse' | 'closed' | 'invoice_open' | 'already';

export function duplicateAnswer(state: PlaceState, requiresPayment: boolean): DuplicateAnswer {
  switch (state) {
    case 'invoice_open':
      return 'invoice_open';
    case 'closed':
      return 'closed';
    case 'retry':
      return requiresPayment ? 'reuse' : 'already';
    case 'held':
      return 'already';
  }
}

/** May a list offer "Join" for this thread? Exactly when the route would take
 *  the sign-up — derived from duplicateAnswer, never restated. No place at all
 *  is always joinable. */
export function joinableFromList(state: PlaceState | undefined, requiresPayment: boolean): boolean {
  if (!state) return true;
  return duplicateAnswer(state, requiresPayment) === 'reuse';
}

/** Which of these thread_enrolment ids have an INVOICE in the ledger. The
 *  ledger is the marker because `thread_enrolment.billing` can be empty on an
 *  invoice (billing details are optional), while the purchase row always
 *  says how it is paid. A failed card attempt later invoiced is the same row
 *  (upserted on app + item_ref), so its method reads `invoice`. */
export async function invoicedEnrolmentIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data: app } = await adminClient.from('app').select('id').eq('slug', 'the-thread').maybeSingle();
  if (!app) return new Set();
  const { data, error } = await adminClient
    .from('purchase')
    .select('item_ref')
    .eq('app_id', app.id)
    .eq('method', 'invoice')
    .in('item_ref', ids);
  if (error) {
    // Fail CLOSED: an unknown answer is treated as "invoiced", which holds
    // the place. The worst case is a person told to look at their invoice;
    // the other way round is a person charged twice.
    console.error('[place-state] invoice lookup failed; treating as invoiced', error.message);
    return new Set(ids);
  }
  return new Set((data ?? []).map((r) => r.item_ref as string));
}

/** The state of each thread this person has a place on, keyed by thread id,
 *  for the lists. One ledger read for all of them. */
export async function placesByThread(
  rows: {
    id: string;
    thread_id: string | null;
    payment_status: string | null;
    enrolment_status: string | null;
  }[],
): Promise<Map<string, PlaceState>> {
  const unpaid = rows
    .filter((r) => r.payment_status === 'pending' || r.payment_status === 'failed')
    .map((r) => r.id);
  const invoiced = await invoicedEnrolmentIds(unpaid);
  const out = new Map<string, PlaceState>();
  for (const r of rows) {
    if (!r.thread_id) continue;
    out.set(
      r.thread_id,
      placeState({
        enrolmentStatus: r.enrolment_status,
        paymentStatus: r.payment_status,
        invoiced: invoiced.has(r.id),
      }),
    );
  }
  return out;
}

/** Why a closed place is closed, for the sentence the member reads: a
 *  membership-granted place withdrawn when the membership ended, or the
 *  organiser's decision. The membership case leaves a journal row
 *  (membership_member_access, status `revoked`, external_ref = the thread)
 *  for one of this person's memberships; anything else is the organiser's. */
export async function closedReason(
  threadId: string,
  personId: string,
): Promise<'membership_ended' | 'organiser'> {
  const { data: members } = await adminClient
    .from('membership_member')
    .select('id')
    .eq('person_id', personId);
  const ids = (members ?? []).map((m) => m.id as string);
  if (!ids.length) return 'organiser';
  const { data } = await adminClient
    .from('membership_member_access')
    .select('id')
    .in('member_id', ids)
    .eq('status', 'revoked')
    .eq('external_ref', threadId)
    .limit(1);
  return data && data.length ? 'membership_ended' : 'organiser';
}
