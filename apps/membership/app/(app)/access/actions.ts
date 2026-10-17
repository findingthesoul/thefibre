'use server';

import { apiFetch, ApiError } from '@/lib/api';
import type { GrantKind } from './types';

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

// NO revalidatePath in createGrant and deleteGrant (2026-10-17): every caller refreshes
// (useSaveAndRefresh or router.refresh()), so revalidating as well rendered
// the page twice per save. Measured on a tier Save: 1.33 s → 0.82 s, with
// the new data on screen when the dialog closes. Actions whose callers do
// NOT refresh keep their revalidatePath.

export async function createGrant(input: {
  tier_id?: string;
  product_id?: string;
  kind: GrantKind;
  config: Record<string, unknown>;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const r = await apiFetch<{ id: string }>('/api/v1/membership/grants', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return { ok: true, data: { id: r.id } };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// Grants are configuration, not personal data — the API hard-deletes.
export async function deleteGrant(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/membership/grants/${id}`, { method: 'DELETE' });
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}
