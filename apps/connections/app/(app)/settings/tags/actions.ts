'use server';

// Tag cleaning: read what wants tidying, and apply what somebody decided.
// The rules live in the API (apps/api/src/lib/tag-cleaning.ts); nothing here
// decides what is a double.

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type CleanTag = {
  id: string;
  name: string;
  organisation_id: string | null;
  people: number;
  last_used: string | null;
};

export type TagCleaning = {
  doubles: { keep: CleanTag; others: CleanTag[]; reason: 'spelling' | 'plural' | 'typo' }[];
  unused: CleanTag[];
  stale: CleanTag[];
  stale_days: number;
  count: number;
  can_edit: boolean;
};

export type TagActResult = { ok: true } | { ok: false; error: 'forbidden' | 'name_taken' | string };

export async function loadTagCleaning(): Promise<TagCleaning | null> {
  try {
    return await apiFetch<TagCleaning>('/api/v1/connections/tags/cleaning');
  } catch {
    return null;
  }
}

async function act(path: string, init: RequestInit): Promise<TagActResult> {
  try {
    await apiFetch(path, init);
    revalidatePath('/settings/tags');
    revalidatePath('/tags');
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 403) return { ok: false, error: 'forbidden' };
      if (e.status === 409) return { ok: false, error: 'name_taken' };
      return { ok: false, error: `API ${e.status}` };
    }
    return { ok: false, error: 'unknown error' };
  }
}

export async function mergeTags(into: string, from: string[]): Promise<TagActResult> {
  return act('/api/v1/connections/tags/merge', { method: 'POST', body: JSON.stringify({ into, from }) });
}

export async function renameTag(id: string, name: string): Promise<TagActResult> {
  return act(`/api/v1/connections/tags/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
}

export async function deleteTag(id: string): Promise<TagActResult> {
  return act(`/api/v1/connections/tags/${id}`, { method: 'DELETE' });
}
