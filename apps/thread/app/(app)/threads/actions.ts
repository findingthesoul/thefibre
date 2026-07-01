'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: unknown } | undefined;
    if (typeof body?.error === 'string') return body.error;
    if (body?.error) return JSON.stringify(body.error);
    return e.message;
  }
  return e instanceof Error ? e.message : 'unknown error';
}

export async function createThread(input: {
  title: string;
  format: 'event' | 'journey';
  slug: string;
  intention?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
}): Promise<ActionResult> {
  try {
    const created = await apiFetch<{ id: string }>('/api/v1/thread/threads', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath('/threads');
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function updateThread(
  id: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/threads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath('/threads');
    revalidatePath(`/threads/${id}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
