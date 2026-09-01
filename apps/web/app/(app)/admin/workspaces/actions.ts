'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult = { ok?: boolean; error?: string };

function message(e: unknown): string {
  if (e instanceof ApiError) {
    const detail =
      typeof e.body === 'object' && e.body && 'error' in e.body
        ? String((e.body as { error: unknown }).error)
        : '';
    return `API ${e.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`;
  }
  return 'unknown error';
}

export async function createWorkspace(input: {
  name: string;
  plan_id?: string;
  comped?: boolean;
  comped_reason?: string | null;
  custom_price_cents_month?: number | null;
}): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/workspaces', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath('/admin/workspaces');
  return { ok: true };
}

export async function saveSubscription(
  workspaceId: string,
  patch: {
    plan_id?: string;
    comped?: boolean;
    comped_reason?: string | null;
    custom_price_cents_month?: number | null;
    custom_price_cents_year?: number | null;
  },
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/subscription`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath('/admin/workspaces');
  return { ok: true };
}
