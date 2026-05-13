'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult = {
  ok?: boolean;
  error?: string | undefined;
};

function unwrapApiError(e: unknown): ActionResult {
  if (e instanceof ApiError) return { error: `API ${e.status}` };
  return { error: 'Unknown error' };
}

export async function revokeConsent(purpose_code: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/privacy/consent/${purpose_code}`, { method: 'DELETE' });
  } catch (e) {
    return unwrapApiError(e);
  }
  revalidatePath('/privacy');
  return { ok: true };
}

export async function requestErasure(notes: string | null): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/privacy/erasure-request', {
      method: 'POST',
      body: JSON.stringify({ notes: notes ?? undefined }),
    });
  } catch (e) {
    return unwrapApiError(e);
  }
  revalidatePath('/privacy');
  return { ok: true };
}
