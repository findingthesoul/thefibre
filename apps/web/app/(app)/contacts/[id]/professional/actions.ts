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
  return s.split(',').map((x) => x.trim()).filter((x) => x.length > 0);
}

function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function boolOrNull(v: FormDataEntryValue | null): boolean | null {
  const s = String(v ?? '').trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  return null;
}

export async function updateProfessional(
  personId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = {
    current_title: strOrNull(formData.get('current_title')),
    current_department: strOrNull(formData.get('current_department')),
    seniority_level: strOrNull(formData.get('seniority_level')),
    sector: strOrNull(formData.get('sector')),
    expertise_areas: parseList(formData.get('expertise_areas')),
    industries_worked_in: parseList(formData.get('industries_worked_in')),
    years_of_experience: intOrNull(formData.get('years_of_experience')),
    career_stage: strOrNull(formData.get('career_stage')),
    is_independent: boolOrNull(formData.get('is_independent')),
    certifications: parseList(formData.get('certifications')),
    spoken_at_events: parseList(formData.get('spoken_at_events')),
  };

  try {
    await apiFetch(`/api/v1/persons/${personId}/professional`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return unwrapApiError(e);
  }

  revalidatePath(`/contacts/${personId}/professional`);
  return { ok: true };
}
