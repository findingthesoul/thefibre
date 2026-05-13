'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult = {
  ok?: boolean;
  error?: string | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
};

function unwrapApiError(e: unknown): ActionResult {
  if (e instanceof ApiError) {
    const apiBody = e.body as { error?: { fieldErrors?: Record<string, string[]> } } | undefined;
    return { error: `API ${e.status}`, fieldErrors: apiBody?.error?.fieldErrors };
  }
  return { error: 'Unknown error' };
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

function boolOrNull(v: FormDataEntryValue | null): boolean | null {
  const s = String(v ?? '').trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  return null;
}

function parseList(v: FormDataEntryValue | null): string[] {
  const s = String(v ?? '').trim();
  if (!s) return [];
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export async function updateLearning(
  personId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = {
    learning_interests: parseList(formData.get('learning_interests')),
    prior_programmes: parseList(formData.get('prior_programmes')),
    learning_style: strOrNull(formData.get('learning_style')),
    group_role_tendency: strOrNull(formData.get('group_role_tendency')),
    development_goals: strOrNull(formData.get('development_goals')),
    post_programme_reflection: strOrNull(formData.get('post_programme_reflection')),
    open_to_coaching: boolOrNull(formData.get('open_to_coaching')),
    open_to_peer_exchange: boolOrNull(formData.get('open_to_peer_exchange')),
  };

  try {
    await apiFetch(`/api/v1/persons/${personId}/learning`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return unwrapApiError(e);
  }

  revalidatePath(`/contacts/${personId}/learning`);
  return { ok: true };
}
