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

function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseList(v: FormDataEntryValue | null): string[] {
  const s = String(v ?? '').trim();
  if (!s) return [];
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export async function updateOrgRelationship(
  orgId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = {
    primary_owner: strOrNull(formData.get('primary_owner')),
    secondary_owner: strOrNull(formData.get('secondary_owner')),
    relationship_stage: strOrNull(formData.get('relationship_stage')),
    health_status: strOrNull(formData.get('health_status')),
    engagement_type: strOrNull(formData.get('engagement_type')),
    programmes_completed: parseList(formData.get('programmes_completed')),
    total_participants_reached: intOrNull(formData.get('total_participants_reached')),
    touchpoints_count: intOrNull(formData.get('touchpoints_count')),
    relationship_history: strOrNull(formData.get('relationship_history')),
    next_opportunity: strOrNull(formData.get('next_opportunity')),
    last_touchpoint_at: strOrNull(formData.get('last_touchpoint_at')),
    next_planned_contact: strOrNull(formData.get('next_planned_contact')),
  };

  try {
    await apiFetch(`/api/v1/organisations/${orgId}/relationship`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return unwrapApiError(e);
  }

  revalidatePath(`/organisations/${orgId}/relationship`);
  return { ok: true };
}
