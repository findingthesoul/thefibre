'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult = {
  ok?: boolean;
  error?: string | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
};

function unwrap(e: unknown): ActionResult {
  if (e instanceof ApiError) {
    const apiBody = e.body as { error?: { fieldErrors?: Record<string, string[]> } } | undefined;
    return { error: `API ${e.status}`, fieldErrors: apiBody?.error?.fieldErrors };
  }
  return { error: 'Unknown error' };
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

export async function updateMe(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const full_name = strOrNull(formData.get('full_name'));
  const avatar_url = strOrNull(formData.get('avatar_url'));
  if (!full_name) return { error: 'Name is required.' };

  try {
    await apiFetch('/api/v1/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ full_name, avatar_url }),
    });
  } catch (e) {
    return unwrap(e);
  }

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { ok: true };
}
