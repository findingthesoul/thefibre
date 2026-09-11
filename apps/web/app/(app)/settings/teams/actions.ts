'use server';

// Teams-page server actions (teams as access groups, 2026-09-11).
//
// Every one of these is admin-only on the API side; the screens hide the
// controls as a courtesy, the API is what actually refuses.

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult = { ok?: boolean; error?: string };

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: unknown } | undefined;
    if (typeof body?.error === 'string') return body.error;
    return `API ${e.status}`;
  }
  return 'Unknown error';
}

export async function createTeam(input: {
  name: string;
  description?: string | null;
  is_published: boolean;
}): Promise<ActionResult & { id?: string }> {
  try {
    const r = await apiFetch<{ item: { id: string } }>('/api/v1/teams', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath('/settings/teams');
    return { ok: true, id: r.item.id };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function updateTeam(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    is_active?: boolean;
    is_published?: boolean;
  },
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/teams/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
    revalidatePath('/settings/teams');
    revalidatePath(`/settings/teams/${id}`);
    return { ok: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** Replaces the team's whole grant set — the UI always sends the full picture. */
export async function setTeamApps(
  id: string,
  apps: { slug: string; lead_is_app_admin: boolean }[],
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/teams/${id}/apps`, {
      method: 'PUT',
      body: JSON.stringify({ apps }),
    });
    revalidatePath('/settings/teams');
    revalidatePath(`/settings/teams/${id}`);
    revalidatePath('/settings/members');
    return { ok: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function addTeamMember(
  id: string,
  userId: string,
  role: 'lead' | 'member',
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/teams/${id}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role }),
    });
    revalidatePath(`/settings/teams/${id}`);
    revalidatePath('/settings/members');
    return { ok: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function removeTeamMember(id: string, userId: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/teams/${id}/members/${userId}`, { method: 'DELETE' });
    revalidatePath(`/settings/teams/${id}`);
    revalidatePath('/settings/members');
    return { ok: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
