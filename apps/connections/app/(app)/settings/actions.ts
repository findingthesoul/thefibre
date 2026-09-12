'use server';

// Renaming bands. The only write Connections' settings has.
//
// Everything in a 'use server' module must be an async function, so the axis
// vocabulary stays in ../landscape/axes and only types cross (types are
// erased). See that module's header for why it is directive-free.

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type SaveLabelsResult = { ok: true } | { ok: false; error: string };
export type ActResult = { ok: true } | { ok: false; error: string };

/**
 * Accept or dismiss one hygiene finding.
 *
 * Accept records a JUDGEMENT, not an action. For a duplicate it does not
 * merge — merging is `merge_person()`, a real reversible operation with its
 * own confirmation and its own choice of which record survives, and wiring it
 * behind a one-tap button in a cleanup list would make it the most dangerous
 * control in the product. Accept means "somebody looked and agreed this is
 * real"; doing the thing stays where it belongs.
 */
export async function actOnFinding(
  id: string,
  action: 'accept' | 'dismiss',
): Promise<ActResult> {
  try {
    await apiFetch(`/api/v1/connections/hygiene/${id}`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    revalidatePath('/settings/hygiene');
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 403) return { ok: false, error: 'forbidden' };
      return { ok: false, error: `API ${e.status}` };
    }
    return { ok: false, error: 'unknown error' };
  }
}

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

/**
 * Change how long kinds of work take, for the whole workspace. A null puts
 * the shipped default back. Today is revalidated because every estimate on it
 * reads these numbers.
 */
export async function saveEffortDefaults(
  minutes: Record<string, number | null>,
): Promise<ActResult> {
  try {
    await apiFetch('/api/v1/connections/effort', {
      method: 'PUT',
      body: JSON.stringify({ minutes }),
    });
    revalidatePath('/today');
    revalidatePath('/settings/effort');
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 403) return { ok: false, error: 'forbidden' };
      const body = e.body as { error?: unknown } | undefined;
      return { ok: false, error: typeof body?.error === 'string' ? body.error : `API ${e.status}` };
    }
    return { ok: false, error: 'unknown error' };
  }
}
