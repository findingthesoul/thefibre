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

/** One disagreement between the two records, as the API returns it. */
export type Conflict = { name: string; keep_value: unknown; merge_value: unknown };

/**
 * What the two records disagree about, if you keep `keepId`.
 *
 * Asked for the pair somebody actually opened, not for every suggested pair
 * on the page: the conflict VALUES are the records themselves, and shipping
 * both halves of a dozen pairs to a browser that will look at one of them is
 * not a thing to do with personal data.
 *
 * A failure costs the per-field step, not the merge. The caller falls back to
 * merging without choices, which is what this screen did before the step
 * existed — a worse outcome than asking, and a much better one than refusing
 * to merge because a preview could not be fetched.
 */
export async function mergeConflicts(
  keepId: string,
  mergeId: string,
): Promise<{ conflicts?: Conflict[]; error?: string | undefined }> {
  try {
    const r = await apiFetch<{ conflicts: Conflict[] }>(
      `/api/v1/persons/merge-conflicts?keep=${encodeURIComponent(keepId)}&merge=${encodeURIComponent(mergeId)}`,
    );
    return { conflicts: r.conflicts ?? [] };
  } catch (e) {
    return unwrap(e);
  }
}

/**
 * Merge `mergeId` into `keepId`. Reversible — see undoMerge.
 *
 * `choices` names a SIDE per column, never a value, which is what stops this
 * being a way to write an arbitrary field. Omitted or empty = the behaviour
 * since 2026-09-25: the keeper wins and only its blanks are filled.
 */
export async function mergePeople(
  keepId: string,
  mergeId: string,
  choices?: Record<string, 'keep' | 'merge'>,
): Promise<MergeResult> {
  try {
    await apiFetch('/api/v1/persons/merge', {
      method: 'POST',
      body: JSON.stringify({
        keep_id: keepId,
        merge_id: mergeId,
        // Sent only when somebody actually chose something: an empty object
        // is the same as nothing, and not sending it keeps the request
        // identical to the one this screen has always made.
        ...(choices && Object.keys(choices).length ? { choices } : {}),
      }),
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

/** "Different people, same name" — remembered, never proposed again. */
export async function markDistinct(aId: string, bId: string): Promise<MergeResult> {
  try {
    await apiFetch('/api/v1/persons/duplicates/distinct', {
      method: 'POST',
      body: JSON.stringify({ a_id: aId, b_id: bId }),
    });
  } catch (e) {
    return unwrap(e);
  }
  revalidatePath('/contacts/duplicates');
  revalidatePath('/contacts');
  return { ok: true };
}
