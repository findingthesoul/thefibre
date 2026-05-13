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

function parseList(v: FormDataEntryValue | null): string[] | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const arr = s
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  return arr.length ? arr : null;
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
