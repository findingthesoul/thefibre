'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult = { ok: true } | { ok: false; error: string };

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: unknown } | undefined;
    if (typeof body?.error === 'string') return body.error;
    if (body?.error) return JSON.stringify(body.error);
    return e.message;
  }
  return e instanceof Error ? e.message : 'unknown error';
}

export async function grantThreadAccess(
  userId: string,
  role: 'admin' | 'member' = 'member',
): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/thread/internal-team', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role }),
    });
    revalidatePath('/internal-team');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
