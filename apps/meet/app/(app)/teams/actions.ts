'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type SaveResult = { ok?: boolean; error?: string };

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

function bodyFromForm(formData: FormData) {
  return {
    slug: strOrNull(formData.get('slug')) ?? '',
    name: strOrNull(formData.get('name')) ?? '',
    description: strOrNull(formData.get('description')),
    is_active: formData.get('is_active') === 'on',
  };
}

export async function createTeam(
  _prev: SaveResult,
  formData: FormData,
): Promise<SaveResult> {
  const body = bodyFromForm(formData);
  let created: { id: string };
  try {
    created = await apiFetch<{ id: string }>('/api/v1/meet/teams', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
  revalidatePath('/teams');
  redirect(`/teams/${created.id}`);
}

export async function updateTeam(
  id: string,
  _prev: SaveResult,
  formData: FormData,
): Promise<SaveResult> {
  const body = bodyFromForm(formData);
  try {
    await apiFetch(`/api/v1/meet/teams/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
  revalidatePath('/teams');
  revalidatePath(`/teams/${id}`);
  return { ok: true };
}

export async function addMember(
  teamId: string,
  _prev: SaveResult,
  formData: FormData,
): Promise<SaveResult & { invited?: boolean }> {
  const email = strOrNull(formData.get('email'));
  const name = strOrNull(formData.get('name'));
  const role = strOrNull(formData.get('role')) ?? 'member';
  if (!email) return { error: 'email is required' };
  let result: { invited?: boolean } = {};
  try {
    result = await apiFetch<{ invited?: boolean }>(
      `/api/v1/meet/teams/${teamId}/members`,
      {
        method: 'POST',
        body: JSON.stringify({ email, name: name ?? undefined, role }),
      },
    );
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
  revalidatePath(`/teams/${teamId}`);
  return { ok: true, invited: result.invited };
}

export async function removeMember(
  teamId: string,
  userId: string,
): Promise<SaveResult> {
  try {
    await apiFetch(`/api/v1/meet/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
    });
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
  revalidatePath(`/teams/${teamId}`);
  return { ok: true };
}

export async function resendInvite(
  teamId: string,
  userId: string,
): Promise<{ ok?: boolean; error?: string; invite_url?: string }> {
  try {
    const r = await apiFetch<{ invite_url: string }>(
      `/api/v1/meet/teams/${teamId}/members/${userId}/resend-invite`,
      { method: 'POST' },
    );
    revalidatePath(`/teams/${teamId}`);
    return { ok: true, invite_url: r.invite_url };
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
}
