'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult = {
  ok?: boolean;
  error?: string | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
};

function unwrap(e: unknown): ActionResult {
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

function boolOrFalse(v: FormDataEntryValue | null): boolean {
  return String(v ?? '') === 'on';
}

export async function addMember(
  orgId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const person_id = strOrNull(formData.get('person_id'));
  if (!person_id) return { error: 'Select a person.' };

  const body = {
    person_id,
    title: strOrNull(formData.get('title')),
    department: strOrNull(formData.get('department')),
    employment_type: strOrNull(formData.get('employment_type')),
    influence_level: strOrNull(formData.get('influence_level')),
    is_primary: boolOrFalse(formData.get('is_primary')),
    is_decision_maker: boolOrFalse(formData.get('is_decision_maker')),
    is_budget_holder: boolOrFalse(formData.get('is_budget_holder')),
    is_champion: boolOrFalse(formData.get('is_champion')),
    started_at: strOrNull(formData.get('started_at')),
  };

  try {
    await apiFetch(`/api/v1/organisations/${orgId}/members`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return unwrap(e);
  }

  revalidatePath(`/organisations/${orgId}`);
  return { ok: true };
}

export async function endMembership(orgId: string, membershipId: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/organisations/members/${membershipId}/end`, { method: 'POST' });
  } catch (e) {
    return unwrap(e);
  }
  revalidatePath(`/organisations/${orgId}`);
  return { ok: true };
}
