'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult<T = unknown> = { ok?: boolean; error?: string; data?: T };

function formatApiError(e: unknown): string {
  if (!(e instanceof ApiError)) return 'unknown error';
  const body = e.body as { error?: unknown; details?: unknown; code?: string } | undefined;
  const raw = body?.error ?? body?.details ?? body?.code;
  let detail: string | undefined;
  if (typeof raw === 'string') detail = raw;
  else if (raw && typeof raw === 'object') {
    try {
      detail = JSON.stringify(raw);
    } catch {
      /* ignore */
    }
  }
  return detail ? `API ${e.status}: ${detail}` : `API ${e.status}`;
}

export type TierInput = {
  name: string;
  currency: string;
  description: string | null;
  characteristics: string[];
  price_cents_year: number | null;
  price_cents_month: number | null;
  sort_order: number;
};

export async function createTier(input: TierInput): Promise<ActionResult<{ id: string }>> {
  try {
    const r = await apiFetch<{ id: string }>('/api/v1/membership/tiers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath('/tiers');
    return { ok: true, data: { id: r.id } };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// Also carries archive/unarchive — PATCH {archived} flips archived_at server-side.
export async function patchTier(
  id: string,
  input: Partial<TierInput> & { archived?: boolean },
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/membership/tiers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    revalidatePath('/tiers');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// Replaces the tier's included products whole (the dialog saves the full set).
export async function setTierProducts(id: string, productIds: string[]): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/membership/tiers/${id}/products`, {
      method: 'PUT',
      body: JSON.stringify({ product_ids: productIds }),
    });
    revalidatePath('/tiers');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}
