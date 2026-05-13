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

function parseList(v: FormDataEntryValue | null): string[] {
  const s = String(v ?? '').trim();
  if (!s) return [];
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export async function updateChange(
  personId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = {
    role_in_change: strOrNull(formData.get('role_in_change')),
    stance_on_change: strOrNull(formData.get('stance_on_change')),
    change_themes: parseList(formData.get('change_themes')),
    leadership_style: strOrNull(formData.get('leadership_style')),
    blockers: parseList(formData.get('blockers')),
    motivators: parseList(formData.get('motivators')),
    current_challenge: strOrNull(formData.get('current_challenge')),
    facilitator_notes: strOrNull(formData.get('facilitator_notes')),
    readiness_level: strOrNull(formData.get('readiness_level')),
  };

  try {
    await apiFetch(`/api/v1/persons/${personId}/change`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return unwrapApiError(e);
  }

  revalidatePath(`/contacts/${personId}/change`);
  return { ok: true };
}
