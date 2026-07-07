'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, errorMessage } from '@/lib/api';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createTeam(input: {
  name: string;
  slug: string;
  description?: string | null;
}): Promise<ActionResult> {
  try {
    const created = await apiFetch<{ id: string }>('/api/v1/thread/teams', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath('/teams');
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function addTeamMember(
  teamId: string,
  userId: string,
  role: 'lead' | 'member',
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role }),
    });
    revalidatePath(`/teams/${teamId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function removeTeamMember(
  teamId: string,
  userId: string,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
    });
    revalidatePath(`/teams/${teamId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
