'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type DecideResult = { ok?: boolean; error?: string };

export async function decideRequest(
  id: string,
  action: 'approve' | 'deny',
  notes?: string,
): Promise<DecideResult> {
  try {
    await apiFetch(`/api/v1/signup-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, decision_notes: notes ?? null }),
    });
  } catch (e) {
    if (e instanceof ApiError) {
      return { error: `API ${e.status}` };
    }
    return { error: 'unknown error' };
  }
  revalidatePath('/admin/access-requests');
  return { ok: true };
}
