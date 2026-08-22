'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ReviewResult = { ok?: boolean; error?: string };

export async function reviewApp(
  slug: string,
  action: 'approve' | 'suspend' | 'reinstate',
  notes?: string,
): Promise<ReviewResult> {
  try {
    await apiFetch(`/api/v1/apps/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, review_notes: notes ?? null }),
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: `API ${e.status}` };
    return { error: 'unknown error' };
  }
  revalidatePath('/admin/apps');
  revalidatePath('/settings/apps');
  return { ok: true };
}
