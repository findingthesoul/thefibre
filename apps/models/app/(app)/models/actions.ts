'use server';

// The app-bound half: this app's apiFetch, called from client components
// through server actions so the browser never talks to the API directly.

import { apiFetch, ApiError } from '@/lib/api';
import type { ModelDefinition } from '@/lib/engine';

export type ModelListItem = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  team_id: string | null;
  team: { id: string; name: string } | null;
  updated_at: string;
  created_at: string;
};
export type ModelRow = ModelListItem & { definition: ModelDefinition; inputs: Record<string, unknown>; may_shape: boolean };
export type TeamChoice = { id: string; name: string; role: 'admin' | 'lead' | 'member' };

function fail(e: unknown, fallback: string): { error: string } {
  if (e instanceof ApiError) {
    const body = e.body as { error?: unknown } | undefined;
    return { error: typeof body?.error === 'string' ? body.error : `${fallback} (API ${e.status})` };
  }
  return { error: fallback };
}

export async function listTeams(): Promise<{ items: TeamChoice[]; is_admin: boolean }> {
  try {
    return await apiFetch<{ items: TeamChoice[]; is_admin: boolean }>('/api/v1/models/teams');
  } catch {
    return { items: [], is_admin: false };
  }
}

export async function createModel(input: {
  name: string;
  tagline?: string | null;
  team_id: string | null;
  definition: ModelDefinition;
}): Promise<{ id?: string; error?: string }> {
  try {
    const r = await apiFetch<{ id: string }>('/api/v1/models', { method: 'POST', body: JSON.stringify(input) });
    return { id: r.id };
  } catch (e) {
    return fail(e, 'Could not create the business model.');
  }
}

export type SaveResult = { error?: string; conflict?: boolean; updated_at?: string };

function saveFail(e: unknown, fallback: string): SaveResult {
  if (e instanceof ApiError && e.status === 409) return { error: fallback, conflict: true };
  return fail(e, fallback);
}

/** Saves the numbers; `ifUpdatedAt` is the updated_at last seen, so a save over someone else's change is refused. */
export async function saveInputs(id: string, inputs: Record<string, unknown>, ifUpdatedAt?: string): Promise<SaveResult> {
  try {
    const r = await apiFetch<{ updated_at: string }>(`/api/v1/models/${id}`, { method: 'PATCH', body: JSON.stringify({ inputs, if_updated_at: ifUpdatedAt }) });
    return { updated_at: r.updated_at };
  } catch (e) {
    return saveFail(e, 'Could not save.');
  }
}

export async function updateModel(
  id: string,
  patch: { name?: string; tagline?: string | null; description?: string | null; team_id?: string | null; definition?: ModelDefinition },
  ifUpdatedAt?: string,
): Promise<SaveResult> {
  try {
    const r = await apiFetch<{ updated_at: string }>(`/api/v1/models/${id}`, { method: 'PATCH', body: JSON.stringify({ ...patch, if_updated_at: ifUpdatedAt }) });
    return { updated_at: r.updated_at };
  } catch (e) {
    return saveFail(e, 'Could not update the business model.');
  }
}

export async function duplicateModel(id: string, name?: string): Promise<{ id?: string; error?: string }> {
  try {
    const r = await apiFetch<{ id: string }>(`/api/v1/models/${id}/duplicate`, { method: 'POST', body: JSON.stringify(name ? { name } : {}) });
    return { id: r.id };
  } catch (e) {
    return fail(e, 'Could not duplicate the business model.');
  }
}

export async function deleteModel(id: string): Promise<{ error?: string }> {
  try {
    await apiFetch(`/api/v1/models/${id}`, { method: 'DELETE' });
    return {};
  } catch (e) {
    return fail(e, 'Could not delete the business model.');
  }
}
