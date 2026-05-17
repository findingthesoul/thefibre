'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type SaveResult = { ok?: boolean; error?: string };

// Surface the API's error detail (zod flatten, RLS hint, Postgres message)
// in the form's red banner so we don't lose the actual reason behind a
// bare "API 500". Without this, a 500 reads as "save failed somehow" and
// you have to tail Fly logs to know more.
function formatApiError(e: unknown): string {
  if (!(e instanceof ApiError)) return 'unknown error';
  const body = e.body as { error?: unknown; details?: unknown; code?: string } | undefined;
  const raw = body?.error ?? body?.details ?? body?.code;
  let detail: string | undefined;
  if (typeof raw === 'string') detail = raw;
  else if (raw && typeof raw === 'object') {
    try { detail = JSON.stringify(raw); } catch { /* ignore */ }
  }
  return detail ? `API ${e.status}: ${detail}` : `API ${e.status}`;
}

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
  // Capacity is meaningful for group + one_off MTs (single-attendee one-offs
  // omit the field, which falls back to 1 on the server).
  const capacityRaw = strOrNull(formData.get('capacity'));
  const capacity =
    (eventType === 'group' || eventType === 'one_off') && capacityRaw
      ? Math.max(1, parseInt(capacityRaw, 10) || 0) || null
      : null;
  // One-off MTs carry a fixed date/time. Parse from local datetime-input value
  // (YYYY-MM-DDTHH:MM) using the duration to derive ends_at. Null out for
  // every other event type so a one-off→group conversion doesn't leave stale data.
  const fixedRaw = strOrNull(formData.get('fixed_starts_at_local'));
  const duration = intOr(formData.get('duration_minutes'), 30);
  let fixed_starts_at: string | null = null;
  let fixed_ends_at: string | null = null;
  if (eventType === 'one_off' && fixedRaw) {
    const start = new Date(fixedRaw);
    if (!Number.isNaN(start.getTime())) {
      fixed_starts_at = start.toISOString();
      fixed_ends_at = new Date(start.getTime() + duration * 60_000).toISOString();
    }
  }
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
    fixed_starts_at,
    fixed_ends_at,
    working_hours_override,
    conflict_calendar_ids,
  };
}

// Replace the candidate-slot list on a poll MT.
export async function savePollSlots(
  mtId: string,
  slots: { starts_at: string; ends_at: string }[],
): Promise<SaveResult> {
  try {
    await apiFetch(`/api/v1/meet/meeting-types/${mtId}/poll-slots`, {
      method: 'PUT',
      body: JSON.stringify({ slots }),
    });
  } catch (e) {
    return { error: formatApiError(e) };
  }
  revalidatePath(`/meeting-types/${mtId}`);
  return { ok: true };
}

// Host picks a winning poll slot — converts the MT into a one_off.
export async function confirmPollSlot(
  mtId: string,
  starts_at: string,
): Promise<SaveResult> {
  try {
    await apiFetch(`/api/v1/meet/meeting-types/${mtId}/confirm-poll-slot`, {
      method: 'POST',
      body: JSON.stringify({ starts_at }),
    });
  } catch (e) {
    return { error: formatApiError(e) };
  }
  revalidatePath(`/meeting-types/${mtId}`);
  return { ok: true };
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
    return { error: formatApiError(e) };
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
    return { error: formatApiError(e) };
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
    return { error: formatApiError(e) };
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
    return { error: formatApiError(e) };
  }
  revalidatePath('/meeting-types');
  revalidatePath(`/meeting-types/${id}`);
  return { ok: true };
}
