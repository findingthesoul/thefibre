'use server';

// Server actions for the per-thread Registrations popup. Kept out of
// ../actions.ts on purpose — that file is the shared thread CRUD surface;
// this one exists only for the timeline's enrolment dialog.

import { apiFetch, ApiError } from '@/lib/api';

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: unknown } | undefined;
    if (typeof body?.error === 'string') return body.error;
    if (body?.error) return JSON.stringify(body.error);
    return e.message;
  }
  return e instanceof Error ? e.message : 'unknown error';
}

// Same item shape the /enrolments page consumes (PostgREST join:
// object-or-array — normalize with one() on the client).
export type ThreadEnrolmentItem = {
  id: string;
  thread_id: string;
  payment_status: string;
  amount_cents: number | null;
  currency: string | null;
  answers?: Record<string, unknown> | null;
  billing?: { company?: string; address?: string; tax_no?: string } | null;
  stripe_session_id?: string | null;
  ticket?: { name: string } | { name: string }[] | null;
  coupon?: { code: string } | { code: string }[] | null;
  created_at: string;
  person:
    | { id: string; first_name: string | null; last_name: string | null; email: string | null }
    | { id: string; first_name: string | null; last_name: string | null; email: string | null }[]
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
