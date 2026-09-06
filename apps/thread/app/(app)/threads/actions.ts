'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, errorMessage } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createThread(input: {
  title: string;
  format: 'event' | 'journey';
  slug: string;
  intention?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  team_id?: string | null;
}): Promise<ActionResult> {
  try {
    const created = await apiFetch<{ id: string }>('/api/v1/thread/threads', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath('/threads');
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteThread(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/threads/${id}`, { method: 'DELETE' });
    revalidatePath('/threads');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function duplicateThread(id: string): Promise<ActionResult> {
  try {
    const created = await apiFetch<{ id: string }>(`/api/v1/thread/threads/${id}/duplicate`, {
      method: 'POST',
    });
    revalidatePath('/threads');
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function updateThread(
  id: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/threads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath('/threads');
    revalidatePath(`/threads/${id}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// Engagements
// ---------------------------------------------------------------------------

export async function createEngagement(
  threadId: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    const created = await apiFetch<{ id: string }>(
      `/api/v1/thread/threads/${threadId}/engagements`,
      { method: 'POST', body: JSON.stringify(input) },
    );
    revalidatePath(`/threads/${threadId}`);
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function updateEngagement(
  threadId: string,
  engagementId: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/engagements/${engagementId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath(`/threads/${threadId}`);
    return { ok: true, id: engagementId };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteEngagement(
  threadId: string,
  engagementId: string,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/engagements/${engagementId}`, { method: 'DELETE' });
    revalidatePath(`/threads/${threadId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function addThreadMember(
  threadId: string,
  userId: string,
  role: 'host' | 'facilitator',
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/threads/${threadId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role }),
    });
    revalidatePath(`/threads/${threadId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function removeThreadMember(
  threadId: string,
  organiserId: string,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/threads/${threadId}/members/${organiserId}`, {
      method: 'DELETE',
    });
    revalidatePath(`/threads/${threadId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// Tickets (pricing tab — list of ticket prices, v3 model)
// ---------------------------------------------------------------------------

export type TicketRow = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  price_currency: string;
  quantity_limit: number | null;
  available_until: string | null;
  is_active: boolean;
  position: number;
  payment_methods?: ('stripe' | 'invoice')[] | null;
};

export type CouponRow = {
  id: string;
  code: string;
  name: string | null;
  type: 'percentage' | 'amount' | 'free';
  discount_percentage: number | null;
  discount_amount_cents: number | null;
  usage_limit: number | null;
  used_count: number;
  expires_at: string | null;
  is_early_bird: boolean;
  early_bird_deadline: string | null;
  is_active: boolean;
};

export type ListResult<T> = { ok: true; items: T[] } | { ok: false; error: string };

export async function listTickets(threadId: string): Promise<ListResult<TicketRow>> {
  try {
    const res = await apiFetch<{ items: TicketRow[] }>(
      `/api/v1/thread/threads/${threadId}/tickets`,
    );
    return { ok: true, items: res.items ?? [] };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function createTicket(
  threadId: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    const created = await apiFetch<{ id: string }>(`/api/v1/thread/threads/${threadId}/tickets`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath(`/threads/${threadId}`);
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function updateTicket(
  threadId: string,
  ticketId: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath(`/threads/${threadId}`);
    return { ok: true, id: ticketId };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteTicket(threadId: string, ticketId: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/tickets/${ticketId}`, { method: 'DELETE' });
    revalidatePath(`/threads/${threadId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// Coupons (discount codes — code is uppercased server-side; 409 = duplicate)
// ---------------------------------------------------------------------------

export async function listCoupons(threadId: string): Promise<ListResult<CouponRow>> {
  try {
    const res = await apiFetch<{ items: CouponRow[] }>(
      `/api/v1/thread/threads/${threadId}/coupons`,
    );
    return { ok: true, items: res.items ?? [] };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function createCoupon(
  threadId: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    const created = await apiFetch<{ id: string }>(`/api/v1/thread/threads/${threadId}/coupons`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath(`/threads/${threadId}`);
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function updateCoupon(
  threadId: string,
  couponId: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/coupons/${couponId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath(`/threads/${threadId}`);
    return { ok: true, id: couponId };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteCoupon(threadId: string, couponId: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/coupons/${couponId}`, { method: 'DELETE' });
    revalidatePath(`/threads/${threadId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// Payout — which Stripe accounts are actually connected
// ---------------------------------------------------------------------------

export type PayoutInfo = {
  ok: true;
  workspace_connected: boolean;
  personal_connected: boolean;
};

export async function getPayoutInfo(): Promise<PayoutInfo | { ok: false; error: string }> {
  try {
    const [settings, me] = await Promise.all([
      apiFetch<{ stripe_account_id: string | null }>('/api/v1/thread/settings'),
      apiFetch<{ stripe_account_id: string | null }>('/api/v1/thread/me'),
    ]);
    return {
      ok: true,
      workspace_connected: !!settings.stripe_account_id,
      personal_connected: !!me.stripe_account_id,
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// Certificates — issuance
// ---------------------------------------------------------------------------

export async function issueEnrolmentCertificate(
  enrolmentId: string,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/enrolments/${enrolmentId}/certificate`, { method: 'POST' });
    revalidatePath('/enrolments');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/** Regenerate the snapshot from the CURRENT template — number, recipient
 *  and issue date stay; shared verification links keep working. */
export async function reissueCertificate(enrolmentId: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/enrolments/${enrolmentId}/reissue-certificate`, {
      method: 'POST',
    });
    revalidatePath('/enrolments');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/** Email the payer their receipt / invoice for this enrolment's purchase. */
export async function resendReceiptForEnrolment(enrolmentId: string): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/purchases/resend-by-ref', {
      method: 'POST',
      body: JSON.stringify({ app: 'the-thread', item_ref: enrolmentId }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/** Email the participant their certificate link — explicit, never automatic. */
export async function sendCertificateEmail(enrolmentId: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/enrolments/${enrolmentId}/send-certificate`, {
      method: 'POST',
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function bulkIssueCertificates(
  threadId: string,
): Promise<{ ok: true; issued: number; skipped: number } | { ok: false; error: string }> {
  try {
    const r = await apiFetch<{ issued: number; skipped: number }>(
      `/api/v1/thread/threads/${threadId}/certificates/bulk`,
      { method: 'POST' },
    );
    revalidatePath('/enrolments');
    return { ok: true, issued: r.issued, skipped: r.skipped };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// Check-in (the door)
// ---------------------------------------------------------------------------

export async function checkinEnrolment(
  threadId: string,
  enrolmentId: string,
  undo = false,
): Promise<{ ok: true; checked_in_at: string | null } | { ok: false; error: string }> {
  try {
    const r = await apiFetch<{ ok: boolean; checked_in_at: string | null }>(
      `/api/v1/thread/enrolments/${enrolmentId}/checkin`,
      { method: 'POST', body: JSON.stringify({ undo }) },
    );
    revalidatePath(`/threads/${threadId}/checkin`);
    return { ok: true, checked_in_at: r.checked_in_at ?? null };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}


export async function setThreadCategories(
  threadId: string,
  categoryIds: string[],
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/threads/${threadId}/categories`, {
      method: 'PUT',
      body: JSON.stringify({ category_ids: categoryIds }),
    });
    revalidatePath(`/threads/${threadId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * One scan, one verdict. The door needs a single answer it can paint across
 * the screen — admitted, refused, or already in — so resolving the code and
 * opening the door happen here rather than as two round trips from the phone.
 *
 * "Already checked in" is a REFUSAL, not a success: a ticket opens the door
 * once, and the same QR arriving twice is the thing a door exists to notice.
 * Undo in the list, then rescan, stays the honest path back.
 */
export type ScanVerdict =
  | { kind: 'admitted'; name: string }
  | { kind: 'already'; name: string; at: string }
  | { kind: 'refused'; reason: string };

export async function scanTicket(threadId: string, code: string): Promise<ScanVerdict> {
  type Resolved = {
    id: string;
    thread_id: string;
    person_name: string;
    status: string | null;
    checked_in_at: string | null;
  };
  let found: Resolved;
  try {
    found = await apiFetch<Resolved>(`/api/v1/thread/checkin/${code}`);
  } catch (e) {
    const msg = errorMessage(e);
    return {
      kind: 'refused',
      reason: /not found/i.test(msg) ? t(await uiLocale(), 'not_a_ticket') : msg,
    };
  }
  if (found.thread_id !== threadId) {
    return { kind: 'refused', reason: t(await uiLocale(), 'ticket_other_event') };
  }
  if (found.checked_in_at) {
    return { kind: 'already', name: found.person_name, at: found.checked_in_at };
  }
  try {
    const r = await apiFetch<{ ok: boolean; already?: boolean; checked_in_at: string | null }>(
      `/api/v1/thread/enrolments/${found.id}/checkin`,
      { method: 'POST', body: JSON.stringify({}) },
    );
    // Two phones on the same ticket in the same second: the API answers
    // `already` to whichever lost, and the door says so.
    if (r.already && r.checked_in_at) {
      return { kind: 'already', name: found.person_name, at: r.checked_in_at };
    }
    return { kind: 'admitted', name: found.person_name };
  } catch (e) {
    return { kind: 'refused', reason: errorMessage(e) };
  }
}
