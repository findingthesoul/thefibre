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
