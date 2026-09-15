'use server';

// Settings → Assistant: connect or remove the workspace's own model key.
// The key travels once, here → the EU API, which checks it with Anthropic,
// encrypts it and keeps a four-character hint. Nothing is kept in Vercel.

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export async function connectAssistantKey(key: string): Promise<{ hint?: string; error?: string }> {
  try {
    const r = await apiFetch<{ ok: boolean; key_hint: string }>('/api/v1/assistant/workspace-key', {
      method: 'PUT',
      body: JSON.stringify({ key }),
    });
    revalidatePath('/settings/assistant');
    return { hint: r.key_hint };
  } catch (e) {
    if (e instanceof ApiError) {
      const body = e.body as { error?: string } | undefined;
      return { error: body?.error ?? `API ${e.status}` };
    }
    return { error: 'could not reach the API' };
  }
}

export async function disconnectAssistantKey(): Promise<{ ok?: boolean; error?: string }> {
  try {
    await apiFetch('/api/v1/assistant/workspace-key', { method: 'DELETE' });
    revalidatePath('/settings/assistant');
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: `API ${e.status}` };
    return { error: 'could not reach the API' };
  }
}
