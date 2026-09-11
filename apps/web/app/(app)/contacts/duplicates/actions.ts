'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type MergeResult = { ok?: boolean; error?: string | undefined };

function unwrap(e: unknown): MergeResult {
  if (e instanceof ApiError) {
    // The merge function raises for the refusals a person can act on — same
    // workspace, not already deleted, two sign-in accounts — and the API
    // passes that wording through rather than flattening it to a 500. Show
    // it, because "could not merge" helps nobody.
    const body = e.body as { error?: string } | undefined;
    return { error: body?.error ?? `API ${e.status}` };
  }
  return { error: 'Unknown error' };
}

/** Merge `mergeId` into `keepId`. Reversible — see undoMerge. */
export async function mergePeople(keepId: string, mergeId: string): Promise<MergeResult> {
  try {
    await apiFetch('/api/v1/persons/merge', {
      method: 'POST',
      body: JSON.stringify({ keep_id: keepId, merge_id: mergeId }),
    });
  } catch (e) {
    return unwrap(e);
  }
  revalidatePath('/contacts/duplicates');
  revalidatePath('/contacts');
  return { ok: true };
}

/** Put a merge back. Repoints exactly what that merge moved, and restores
 *  the rows a unique constraint would not let it carry. */
export async function undoMerge(mergeId: string): Promise<MergeResult> {
  try {
    await apiFetch(`/api/v1/persons/merges/${mergeId}/undo`, { method: 'POST' });
  } catch (e) {
    return unwrap(e);
  }
  revalidatePath('/contacts/duplicates');
  revalidatePath('/contacts');
  return { ok: true };
}
