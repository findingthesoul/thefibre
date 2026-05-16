'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type InviteResult = { ok?: boolean; error?: string; invited?: boolean };

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

export async function patchMember(
  userId: string,
  patch: Partial<{
    workspace_role: 'admin' | 'member';
    relationship_type: 'internal' | 'external';
    member_status: string | null;
  }>,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    await apiFetch(`/api/v1/meet/internal-team/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath('/internal-team');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
}

export async function inviteInternal(
  _prev: InviteResult,
  formData: FormData,
): Promise<InviteResult> {
  const email = strOrNull(formData.get('email'));
  const name = strOrNull(formData.get('name'));
  const relationship = strOrNull(formData.get('relationship_type')) ?? 'internal';
  if (!email) return { error: 'email is required' };
  try {
    const r = await apiFetch<{ invited?: boolean }>(
      '/api/v1/meet/internal-team',
      {
        method: 'POST',
        body: JSON.stringify({
          email,
          name: name ?? undefined,
          relationship_type: relationship,
        }),
      },
    );
    revalidatePath('/internal-team');
    return { ok: true, invited: !!r.invited };
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
}
