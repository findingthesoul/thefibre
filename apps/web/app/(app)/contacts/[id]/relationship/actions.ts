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

export async function updateRelationship(
  personId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const firstContactAt = strOrNull(formData.get('first_contact_at'));

  const body = {
    source: strOrNull(formData.get('source')),
    source_detail: strOrNull(formData.get('source_detail')),
    introduced_by: strOrNull(formData.get('introduced_by')),
    relationship_strength: strOrNull(formData.get('relationship_strength')),
    communication_preference: strOrNull(formData.get('communication_preference')),
    best_time_to_reach: strOrNull(formData.get('best_time_to_reach')),
    is_key_contact: boolOrNull(formData.get('is_key_contact')),
    is_ambassador: boolOrNull(formData.get('is_ambassador')),
    first_contact_notes: strOrNull(formData.get('first_contact_notes')),
    first_contact_at: firstContactAt ? new Date(firstContactAt).toISOString() : null,
  };

  try {
    await apiFetch(`/api/v1/persons/${personId}/relationship`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return unwrapApiError(e);
  }

  revalidatePath(`/contacts/${personId}/relationship`);
  return { ok: true };
}
