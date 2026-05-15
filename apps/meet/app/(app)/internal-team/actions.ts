'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type InviteResult = { ok?: boolean; error?: string; invited?: boolean };

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

export async function inviteInternal(
  _prev: InviteResult,
  formData: FormData,
): Promise<InviteResult> {
  const email = strOrNull(formData.get('email'));
  const name = strOrNull(formData.get('name'));
  if (!email) return { error: 'email is required' };
  try {
    const r = await apiFetch<{ invited?: boolean }>(
      '/api/v1/meet/internal-team',
      {
        method: 'POST',
        body: JSON.stringify({ email, name: name ?? undefined }),
      },
    );
    revalidatePath('/internal-team');
    return { ok: true, invited: !!r.invited };
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
}
