'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type SaveResult = { ok?: boolean; error?: string };

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

export async function updateHost(
  _prev: SaveResult,
  formData: FormData,
): Promise<SaveResult> {
  let workingHours: Record<string, { start: string; end: string }[]> | null = null;
  const raw = strOrNull(formData.get('working_hours_json'));
  if (raw) {
    try {
      workingHours = JSON.parse(raw);
    } catch {
      return { error: 'working_hours JSON is invalid' };
    }
  }

  const body = {
    slug: strOrNull(formData.get('slug')) ?? undefined,
    bio: strOrNull(formData.get('bio')),
    location: strOrNull(formData.get('location')),
    personal_room_url: strOrNull(formData.get('personal_room_url')),
    timezone: strOrNull(formData.get('timezone')) ?? undefined,
    working_hours: workingHours,
    photo_url: strOrNull(formData.get('photo_url')),
  };

  try {
    await apiFetch('/api/v1/meet/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { ok: true };
}
