'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';
import { apiErrorResult } from '@thefibre/shared/action-error';

export type ActionResult = {
  ok?: boolean;
  error?: string | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
};

function unwrapApiError(e: unknown): ActionResult {
  // ONE implementation, in @thefibre/shared. Twelve copies of this
  // helper cast the body's `error` to an object of field errors, so a
  // plain-string message from the API — "only admins can change
  // members" — fell through and the screen said "API 403".
  return e instanceof ApiError ? apiErrorResult(e.status, e.body) : { error: 'Unknown error' };
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
