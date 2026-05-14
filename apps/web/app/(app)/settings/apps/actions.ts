'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ToggleResult = { ok?: boolean; error?: string };

export async function activateApp(slug: string): Promise<ToggleResult> {
  try {
    await apiFetch(`/api/v1/workspace-apps`, {
      method: 'POST',
      body: JSON.stringify({ app_slug: slug }),
    });
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
  revalidatePath('/settings/apps');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function deactivateApp(slug: string): Promise<ToggleResult> {
  try {
    await apiFetch(`/api/v1/workspace-apps/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    });
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
  revalidatePath('/settings/apps');
  revalidatePath('/dashboard');
  return { ok: true };
}
