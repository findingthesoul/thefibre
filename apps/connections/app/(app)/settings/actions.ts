'use server';

// Renaming bands. The only write Connections' settings has.
//
// Everything in a 'use server' module must be an async function, so the axis
// vocabulary stays in ../landscape/axes and only types cross (types are
// erased). See that module's header for why it is directive-free.

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type SaveLabelsResult = { ok: true } | { ok: false; error: string };

/**
 * Replace the names for one axis. An empty string means "put the shipped
 * name back" — the API deletes the row, and absence is what the fallback
 * reads. Storing the current English as an override instead would freeze
 * that band in English for everybody reading the app in another language.
 *
 * Every surface that prints a band name is revalidated, because a rename
 * changes what the landscape, the people list and the filter chip all say,
 * and leaving one on a cached old name is the kind of inconsistency that
 * makes somebody doubt the rename took.
 */
export async function saveBandLabels(
  axis: string,
  bands: Record<string, string>,
): Promise<SaveLabelsResult> {
  try {
    await apiFetch('/api/v1/connections/labels', {
      method: 'PUT',
      body: JSON.stringify({ axis, bands }),
    });
    revalidatePath('/landscape');
    revalidatePath('/people');
    revalidatePath('/settings/names');
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) {
      const body = e.body as { error?: unknown } | undefined;
      // 403 is the interesting one and it is not a bug: the RLS policy lets
      // only admins rename, because this is shared vocabulary and one person
      // changing "contributes" changes what the whole team reads everywhere.
      if (e.status === 403) return { ok: false, error: 'forbidden' };
      const detail = typeof body?.error === 'string' ? body.error : `API ${e.status}`;
      return { ok: false, error: detail };
    }
    return { ok: false, error: 'unknown error' };
  }
}
