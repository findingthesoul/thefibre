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

function parseList(v: FormDataEntryValue | null): string[] {
  const s = String(v ?? '').trim();
  if (!s) return [];
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export async function updateSystemContext(
  orgId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = {
    transformation_stage: strOrNull(formData.get('transformation_stage')),
    active_change_themes: parseList(formData.get('active_change_themes')),
    structural_tensions: parseList(formData.get('structural_tensions')),
    strategic_priorities: strOrNull(formData.get('strategic_priorities')),
    current_challenges: strOrNull(formData.get('current_challenges')),
    political_landscape: strOrNull(formData.get('political_landscape')),
    leadership_stability: strOrNull(formData.get('leadership_stability')),
    change_readiness: strOrNull(formData.get('change_readiness')),
    previous_interventions: parseList(formData.get('previous_interventions')),
    lessons_from_previous_work: strOrNull(formData.get('lessons_from_previous_work')),
    blockers: parseList(formData.get('blockers')),
    enablers: parseList(formData.get('enablers')),
  };

  try {
    await apiFetch(`/api/v1/organisations/${orgId}/system-context`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return unwrapApiError(e);
  }

  revalidatePath(`/organisations/${orgId}/system-context`);
  return { ok: true };
}
