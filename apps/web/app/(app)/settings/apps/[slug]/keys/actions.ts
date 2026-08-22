'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type MintResult = { token?: string; prefix?: string; error?: string };

export async function mintKey(
  slug: string,
  name: string,
  scopes: string[],
): Promise<MintResult> {
  try {
    // The plaintext token comes back exactly once, here. It is never stored —
    // the API keeps only sha256(token) — so this response is the only chance
    // the user has to copy it.
    const res = await apiFetch<{ token: string; key: { token_prefix: string } }>(
      `/api/v1/apps/${encodeURIComponent(slug)}/keys`,
      { method: 'POST', body: JSON.stringify({ name: name || null, scopes }) },
    );
    revalidatePath(`/settings/apps/${slug}/keys`);
    return { token: res.token, prefix: res.key.token_prefix };
  } catch (e) {
    if (e instanceof ApiError) return { error: `API ${e.status}` };
    return { error: 'unknown error' };
  }
}

export async function revokeKey(slug: string, id: string): Promise<{ ok?: boolean; error?: string }> {
  try {
    await apiFetch(`/api/v1/apps/${encodeURIComponent(slug)}/keys/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: `API ${e.status}` };
    return { error: 'unknown error' };
  }
  revalidatePath(`/settings/apps/${slug}/keys`);
  return { ok: true };
}
