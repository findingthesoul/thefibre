'use server';

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

// NO revalidatePath in every tier action (2026-10-17): every caller refreshes
// (useSaveAndRefresh or router.refresh()), so revalidating as well rendered
// the page twice per save. Measured on a tier Save: 1.33 s → 0.82 s, with
// the new data on screen when the dialog closes. Actions whose callers do
// NOT refresh keep their revalidatePath.

export async function createTier(input: TierInput): Promise<ActionResult<{ id: string }>> {
  try {
    const r = await apiFetch<{ id: string }>('/api/v1/membership/tiers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
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
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// Replaces the tier's included products whole (the dialog saves the full set).
export async function setTierProducts(id: string, productIds: string[], optionalProductIds: string[] = []): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/membership/tiers/${id}/products`, {
      method: 'PUT',
      body: JSON.stringify({ product_ids: productIds, optional_product_ids: optionalProductIds }),
    });
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}
