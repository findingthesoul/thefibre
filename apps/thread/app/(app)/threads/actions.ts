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
  team_id?: string | null;
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

// ---------------------------------------------------------------------------
// Engagements
// ---------------------------------------------------------------------------

export async function createEngagement(
  threadId: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    const created = await apiFetch<{ id: string }>(
      `/api/v1/thread/threads/${threadId}/engagements`,
      { method: 'POST', body: JSON.stringify(input) },
    );
    revalidatePath(`/threads/${threadId}`);
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function updateEngagement(
  threadId: string,
  engagementId: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/engagements/${engagementId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath(`/threads/${threadId}`);
    return { ok: true, id: engagementId };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteEngagement(
  threadId: string,
  engagementId: string,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/engagements/${engagementId}`, { method: 'DELETE' });
    revalidatePath(`/threads/${threadId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function addThreadMember(
  threadId: string,
  userId: string,
  role: 'host' | 'facilitator',
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/threads/${threadId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role }),
    });
    revalidatePath(`/threads/${threadId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function removeThreadMember(
  threadId: string,
  organiserId: string,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/threads/${threadId}/members/${organiserId}`, {
      method: 'DELETE',
    });
    revalidatePath(`/threads/${threadId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/** Swap positions with the neighbour above/below. Two PATCHes; fine at this scale. */
export async function moveEngagement(
  threadId: string,
  a: { id: string; position: number },
  b: { id: string; position: number },
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/engagements/${a.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ position: b.position }),
    });
    await apiFetch(`/api/v1/thread/engagements/${b.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ position: a.position }),
    });
    revalidatePath(`/threads/${threadId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
