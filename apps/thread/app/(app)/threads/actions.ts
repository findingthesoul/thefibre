'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: unknown } | undefined;
    if (typeof body?.error === 'string') return body.error;
    if (body?.error) return JSON.stringify(body.error);
    return e.message;
  }
  return e instanceof Error ? e.message : 'unknown error';
}

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

/** Swap positions with the neighbour above/below. Two PATCHes; fine at this scale. */
export async function moveEngagement(
  threadId: string,
  a: { id: string; position: number },
  b: { id: string; position: number },
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/engagements/${a.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ position: b.position }),
    });
    await apiFetch(`/api/v1/thread/engagements/${b.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ position: a.position }),
    });
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
