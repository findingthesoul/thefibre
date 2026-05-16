'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type SaveResult = { ok?: boolean; error?: string };

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}
function intOr(v: FormDataEntryValue | null, fallback: number): number {
  const s = String(v ?? '').trim();
  if (!s) return fallback;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : fallback;
}

function bodyFromForm(formData: FormData) {
  const teamId = strOrNull(formData.get('team_id'));
  const whRaw = strOrNull(formData.get('working_hours_override_json'));
  let working_hours_override: unknown = null;
  if (whRaw) {
    try {
      working_hours_override = JSON.parse(whRaw);
    } catch {
      // ignore
    }
  }
  const calRaw = strOrNull(formData.get('conflict_calendar_ids_json'));
  let conflict_calendar_ids: string[] | null = null;
  if (calRaw) {
    try {
      const parsed = JSON.parse(calRaw);
      if (Array.isArray(parsed)) conflict_calendar_ids = parsed;
    } catch {
      // ignore
    }
  }
  const eventType = strOrNull(formData.get('event_type')) ?? 'one_on_one';
  // Capacity is only meaningful for group MTs. Null out otherwise so we don't
  // store a stale value when an MT is converted away from group later.
  const capacityRaw = strOrNull(formData.get('capacity'));
  const capacity =
    eventType === 'group' && capacityRaw
      ? Math.max(1, parseInt(capacityRaw, 10) || 0) || null
      : null;
  return {
    slug: strOrNull(formData.get('slug')) ?? '',
    name: strOrNull(formData.get('name')) ?? '',
    description: strOrNull(formData.get('description')),
    duration_minutes: intOr(formData.get('duration_minutes'), 30),
    buffer_before_minutes: intOr(formData.get('buffer_before_minutes'), 0),
    buffer_after_minutes: intOr(formData.get('buffer_after_minutes'), 0),
    min_notice_minutes: intOr(formData.get('min_notice_minutes'), 60),
    max_advance_days: intOr(formData.get('max_advance_days'), 60),
    conferencing_provider: strOrNull(formData.get('conferencing_provider')) ?? 'google_meet',
    default_location: strOrNull(formData.get('default_location')),
    is_active: formData.get('is_active') === 'on',
    team_id: teamId && teamId !== 'personal' ? teamId : null,
    event_type: eventType,
    capacity,
    working_hours_override,
    conflict_calendar_ids,
  };
}

export async function createMeetingType(
  _prev: SaveResult,
  formData: FormData,
): Promise<SaveResult> {
  const body = bodyFromForm(formData);
  let created: { id: string };
  try {
    created = await apiFetch<{ id: string }>('/api/v1/meet/meeting-types', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
  revalidatePath('/meeting-types');
  redirect(`/meeting-types/${created.id}`);
}

export async function addAssignee(
  mtId: string,
  userId: string,
  isPrimary: boolean,
): Promise<SaveResult> {
  try {
    await apiFetch(`/api/v1/meet/meeting-types/${mtId}/assignees`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, is_primary: isPrimary }),
    });
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
  revalidatePath(`/meeting-types/${mtId}`);
  return { ok: true };
}

export async function removeAssignee(
  mtId: string,
  userId: string,
): Promise<SaveResult> {
  try {
    await apiFetch(`/api/v1/meet/meeting-types/${mtId}/assignees/${userId}`, {
      method: 'DELETE',
    });
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
  revalidatePath(`/meeting-types/${mtId}`);
  return { ok: true };
}

export async function updateMeetingType(
  id: string,
  _prev: SaveResult,
  formData: FormData,
): Promise<SaveResult> {
  const body = bodyFromForm(formData);
  try {
    await apiFetch(`/api/v1/meet/meeting-types/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
  revalidatePath('/meeting-types');
  revalidatePath(`/meeting-types/${id}`);
  return { ok: true };
}
