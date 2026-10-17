'use server';

// Server actions for the per-thread Registrations popup. Kept out of
// ../actions.ts on purpose — that file is the shared thread CRUD surface;
// this one exists only for the timeline's enrolment dialog.

import { apiFetch, errorMessage } from '@/lib/api';
import type { Billing } from '@/lib/thread-types';

// Same item shape the /enrolments page consumes (PostgREST join:
// object-or-array — normalize with one() on the client).
export type ThreadEnrolmentItem = {
  id: string;
  thread_id: string;
  payment_status: string;
  amount_cents: number | null;
  currency: string | null;
  answers?: Record<string, unknown> | null;
  billing?: Billing | null;
  stripe_session_id?: string | null;
  ticket?: { name: string } | { name: string }[] | null;
  coupon?: { code: string } | { code: string }[] | null;
  created_at: string;
  person:
    | { id: string; first_name: string | null; last_name: string | null; email: string | null; phone?: string | null; city?: string | null; country?: string | null; preferred_language?: string | null }
    | { id: string; first_name: string | null; last_name: string | null; email: string | null; phone?: string | null; city?: string | null; country?: string | null; preferred_language?: string | null }[]
    | null;
  enrolment:
    | { status: string; progress_pct: number; enrolled_at: string | null; completed_at?: string | null }
    | { status: string; progress_pct: number; enrolled_at: string | null; completed_at?: string | null }[]
    | null;
  certificate:
    | { certificate_number: string }
    | { certificate_number: string }[]
    | null;
};

type SimpleResult = { ok: true } | { ok: false; error: string };

async function postEnrolmentAction(id: string, action: string): Promise<SimpleResult> {
  try {
    await apiFetch(`/api/v1/thread/enrolments/${id}/${action}`, { method: 'POST' });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/** invited → enrolled; sends confirmation + on_enrolment/on_approval messages. */
export async function approveEnrolment(id: string): Promise<SimpleResult> {
  return postEnrolmentAction(id, 'approve');
}

/** invited → dropped. No email — declining reasons vary too much. */
export async function declineEnrolment(id: string): Promise<SimpleResult> {
  return postEnrolmentAction(id, 'decline');
}

/** → completed; fires on_completion messages + auto-issues the certificate. */
export async function completeEnrolment(id: string): Promise<SimpleResult> {
  return postEnrolmentAction(id, 'complete');
}

/** Invoice paid — organiser confirms; runs the same side-effects as Stripe. */
export async function markEnrolmentPaid(id: string): Promise<SimpleResult> {
  return postEnrolmentAction(id, 'mark-paid');
}

export async function listThreadEnrolments(
  threadId: string,
): Promise<{ ok: true; items: ThreadEnrolmentItem[] } | { ok: false; error: string }> {
  try {
    const r = await apiFetch<{ items: ThreadEnrolmentItem[] }>(
      `/api/v1/thread/enrolments?thread_id=${encodeURIComponent(threadId)}`,
    );
    return { ok: true, items: r.items };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function addThreadParticipant(
  threadId: string,
  input: {
    name: string;
    email: string;
    notify: boolean;
    // Paid threads: 'invoice' emails a pending invoice (amount resolved
    // server-side from the ticket); 'comped' is today's free add.
    billing?: 'invoice' | 'comped';
    ticket_id?: string | null;
  },
): Promise<
  | { ok: true; already: boolean; reactivated: boolean; invoicePending: boolean }
  | { ok: false; error: string }
> {
  try {
    const r = await apiFetch<{
      ok: boolean;
      already_enrolled?: boolean;
      reactivated?: boolean;
      invoice_pending?: boolean;
    }>(`/api/v1/thread/threads/${threadId}/participants`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return {
      ok: true,
      already: r.already_enrolled === true,
      reactivated: r.reactivated === true,
      invoicePending: r.invoice_pending === true,
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

// Pricing context for the add-participant popup: the thread's legacy price
// plus its active tickets (tickets are THE price source when they exist).
export type ThreadPricingTicket = {
  id: string;
  name: string;
  price_cents: number;
  price_currency: string;
};
export type ThreadPricing = {
  price_cents: number | null;
  price_currency: string | null;
  tickets: ThreadPricingTicket[];
};

export async function getThreadPricing(
  threadId: string,
): Promise<{ ok: true; pricing: ThreadPricing } | { ok: false; error: string }> {
  try {
    const [thread, tickets] = await Promise.all([
      apiFetch<{ price_cents: number | null; price_currency: string | null }>(
        `/api/v1/thread/threads/${threadId}`,
      ),
      apiFetch<{
        items: {
          id: string;
          name: string;
          price_cents: number;
          price_currency: string;
          is_active: boolean;
        }[];
      }>(`/api/v1/thread/threads/${threadId}/tickets`),
    ]);
    return {
      ok: true,
      pricing: {
        price_cents: thread.price_cents ?? null,
        price_currency: thread.price_currency ?? null,
        tickets: (tickets.items ?? [])
          .filter((t) => t.is_active)
          .map((t) => ({
            id: t.id,
            name: t.name,
            price_cents: t.price_cents,
            price_currency: t.price_currency,
          })),
      },
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// Cancellation requests (Sjoerd's 2iv): a participant asked, the organiser
// decides here. Approve drops the place (Decline's own path) and, when ticked
// on a card place, refunds through Reimburse; reject keeps it.
// ---------------------------------------------------------------------------

export type CancellationRequestItem = {
  id: string;
  enrolment_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  reason: string | null;
  decision_note: string | null;
  decided_at: string | null;
  refunded_cents: number | null;
  refund_error: string | null;
  created_at: string;
  person_name: string | null;
  person_email: string | null;
  /** The card payment an approval could give back; null when there is none. */
  refundable: { amount_cents: number; currency: string; remaining_cents?: number } | null;
  /** What the refund RULE says, counted at the request's date (refund
   *  rules, slice 2). Information only: the approve action still refunds in
   *  full or not at all. Null when nothing was paid. */
  refund_quote?: {
    pct: number;
    fee_cents: number;
    refund_cents: number;
    reason: 'no_rule' | 'step' | 'after_last_step' | 'started' | 'no_start' | 'nothing_paid';
    currency: string;
    paid_cents: number;
    changes_at: string | null;
    next_pct?: number | null;
    rule_source: 'thread' | 'workspace' | null;
    counted_at: string;
  } | null;
};

export async function listCancellationRequests(
  threadId: string,
): Promise<{ ok: true; items: CancellationRequestItem[] } | { ok: false; error: string }> {
  try {
    const r = await apiFetch<{ items: CancellationRequestItem[] }>(
      `/api/v1/thread/threads/${encodeURIComponent(threadId)}/cancellation-requests`,
    );
    return { ok: true, items: r.items };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function approveCancellation(
  id: string,
  /** What to give back (refund rules, slice 3a): an amount in cents, and a
   *  reason when it is not the rule's. Null = no refund. */
  refund: { amount_cents: number; reason: string | null } | null,
): Promise<
  | { ok: true; refunded_cents: number | null; refund_error: string | null; credit_note: { id: string; number: string; emailed?: boolean } | null }
  | { ok: false; error: string }
> {
  try {
    const r = await apiFetch<{ refunded_cents: number | null; refund_error: string | null; credit_note?: { id: string; number: string; emailed?: boolean } | null }>(
      `/api/v1/thread/cancellation-requests/${encodeURIComponent(id)}/approve`,
      { method: 'POST', body: JSON.stringify(refund ? { amount_cents: refund.amount_cents, reason: refund.reason } : {}) },
    );
    return { ok: true, refunded_cents: r.refunded_cents ?? null, refund_error: r.refund_error ?? null, credit_note: r.credit_note ?? null };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function rejectCancellation(id: string, note: string | null): Promise<SimpleResult> {
  try {
    await apiFetch(`/api/v1/thread/cancellation-requests/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
