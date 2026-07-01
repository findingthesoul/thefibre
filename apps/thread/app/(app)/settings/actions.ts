'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

type Result = { ok: true } | { ok: false; error: string };

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: unknown } | undefined;
    if (typeof body?.error === 'string') return body.error;
    if (body?.error) return JSON.stringify(body.error);
    return e.message;
  }
  return e instanceof Error ? e.message : 'unknown error';
}

export async function updateOrganiser(patch: Record<string, unknown>): Promise<Result> {
  try {
    await apiFetch('/api/v1/thread/me', { method: 'PATCH', body: JSON.stringify(patch) });
    revalidatePath('/settings/profile');
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
