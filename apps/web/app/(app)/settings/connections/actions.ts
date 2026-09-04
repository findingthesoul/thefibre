'use server';

// Connections actions — the platform-hosted twin of Thread's (the SPoT UI
// belongs on The Fibre too; the canon links every app here). Same three
// wrappers over /api/v1/meet, return=fibre so Google lands back HERE.

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

type Result = { ok: true } | { ok: false; error: string };

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: unknown } | undefined;
    if (typeof body?.error === 'string') return body.error;
    return e.message;
  }
  return e instanceof Error ? e.message : 'unknown error';
}

export async function startGoogleAuth(): Promise<{ url?: string; error?: string }> {
  try {
    const r = await apiFetch<{ url: string }>('/api/v1/meet/google/auth-start?return=fibre');
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
