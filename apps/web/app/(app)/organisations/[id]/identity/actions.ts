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
    const apiBody = e.body as
      | { error?: string | { fieldErrors?: Record<string, string[]>; message?: string }; details?: string; hint?: string }
      | undefined;
    const err = apiBody?.error;
    const message =
      typeof err === 'string' ? err
      : typeof err === 'object' ? err?.message
      : undefined;
    const fieldErrors = typeof err === 'object' ? err?.fieldErrors : undefined;
    const detail = apiBody?.details ? ` (${apiBody.details})` : '';
    return {
      error: message ? `${message}${detail}` : `API ${e.status}`,
      fieldErrors,
    };
  }
  return { error: 'Unknown error' };
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

function parseList(v: FormDataEntryValue | null): string[] | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const items = s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return items.length ? items : null;
}

export async function updateIdentity(
  orgId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = {
    mission_statement: strOrNull(formData.get('mission_statement')),
    vision_statement: strOrNull(formData.get('vision_statement')),
    stated_values: parseList(formData.get('stated_values')),
    cultural_descriptors: parseList(formData.get('cultural_descriptors')),
    governance_model: strOrNull(formData.get('governance_model')),
    ownership_type: strOrNull(formData.get('ownership_type')),
    decision_making_style: strOrNull(formData.get('decision_making_style')),
    languages_of_operation: parseList(formData.get('languages_of_operation')),
    maturity_stage: strOrNull(formData.get('maturity_stage')),
    identity_notes: strOrNull(formData.get('identity_notes')),
  };

  try {
    await apiFetch(`/api/v1/organisations/${orgId}/identity`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return unwrapApiError(e);
  }

  revalidatePath(`/organisations/${orgId}/identity`);
  return { ok: true };
}
