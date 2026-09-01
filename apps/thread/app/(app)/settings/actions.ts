'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, errorMessage } from '@/lib/api';

type Result = { ok: true } | { ok: false; error: string };

export async function updateOrganiser(patch: Record<string, unknown>): Promise<Result> {
  try {
    await apiFetch('/api/v1/thread/me', { method: 'PATCH', body: JSON.stringify(patch) });
    revalidatePath('/settings/profile');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

// --- Connections (user-level SPoT; data lives behind /api/v1/meet) -------

export async function startGoogleAuth(): Promise<{ url?: string; error?: string }> {
  try {
    const r = await apiFetch<{ url: string }>('/api/v1/meet/google/auth-start?return=thread');
    return { url: r.url };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function disconnectGoogle(): Promise<Result> {
  try {
    await apiFetch('/api/v1/meet/google/disconnect', { method: 'POST' });
    revalidatePath('/settings/connections');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function updatePersonalRoom(url: string | null): Promise<Result> {
  try {
    await apiFetch('/api/v1/meet/connections', {
      method: 'PATCH',
      body: JSON.stringify({ personal_room_url: url }),
    });
    revalidatePath('/settings/connections');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function updateWorkspaceSettings(
  patch: Record<string, unknown>,
): Promise<Result> {
  try {
    await apiFetch('/api/v1/thread/settings', { method: 'PATCH', body: JSON.stringify(patch) });
    revalidatePath('/settings/workspace');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// Categories (Settings → Categories)
// ---------------------------------------------------------------------------

export async function createCategory(
  name: string,
  scope: 'workspace' | 'mine',
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiFetch('/api/v1/thread/categories', {
      method: 'POST',
      body: JSON.stringify({ name, scope }),
    });
    revalidatePath('/settings/categories');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function renameCategory(
  id: string,
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiFetch(`/api/v1/thread/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    revalidatePath('/settings/categories');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteCategory(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiFetch(`/api/v1/thread/categories/${id}`, { method: 'DELETE' });
    revalidatePath('/settings/categories');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
