'use server';

// Writing a discount code. The API decides whether this person may — the
// routes go through the signed-in user's own identity, so the RLS policy on
// `discount_code` (admins write, the workspace reads) IS the rule rather than
// something restated here.

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type CodePayload = {
  code: string;
  name: string | null;
  type: 'percentage' | 'amount' | 'free';
  discount_percentage: number | null;
  discount_amount_cents: number | null;
  usage_limit: number | null;
  expires_at: string | null;
  is_early_bird: boolean;
  early_bird_deadline: string | null;
  is_active: boolean;
  applies_to: 'workspace' | 'thread' | 'ticket' | 'tier' | 'product';
  applies_to_id: string | null;
};

/** The API's own words, not a generic failure. "A code with that text already
 *  exists here" is something a person can act on; "could not save" is not. */
function said(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: unknown } | undefined;
    if (typeof body?.error === 'string') return body.error;
    return e.message;
  }
  return e instanceof Error ? e.message : 'unknown error';
}

export async function saveDiscountCode(
  id: string | null,
  payload: CodePayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiFetch(id ? `/api/v1/membership/discount-codes/${id}` : '/api/v1/membership/discount-codes', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
    revalidatePath('/settings/discount-codes');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: said(e) };
  }
}

export async function removeDiscountCode(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiFetch(`/api/v1/membership/discount-codes/${id}`, { method: 'DELETE' });
    revalidatePath('/settings/discount-codes');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: said(e) };
  }
}
