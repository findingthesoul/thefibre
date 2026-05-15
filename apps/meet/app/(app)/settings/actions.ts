'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type SaveResult = { ok?: boolean; error?: string };

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

/** PATCH the host with only the fields that appear in the submitted form.
 *  Each split sub-form posts a subset; we never send keys whose field wasn't
 *  in the form (so e.g. the Profile form never wipes working_hours). */
function bodyFromForm(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (formData.has('slug')) {
    const v = strOrNull(formData.get('slug'));
    if (v) out.slug = v;
  }
  if (formData.has('timezone')) {
    const v = strOrNull(formData.get('timezone'));
    if (v) out.timezone = v;
  }
  for (const key of ['bio', 'location', 'personal_room_url', 'photo_url'] as const) {
    if (formData.has(key)) out[key] = strOrNull(formData.get(key));
  }
  if (formData.has('working_hours_json')) {
    const raw = strOrNull(formData.get('working_hours_json'));
    if (raw) {
      try {
        out.working_hours = JSON.parse(raw);
      } catch {
        // ignore; backend will reject if needed
      }
    }
  }
  return out;
}

export async function updateHost(
  _prev: SaveResult,
  formData: FormData,
): Promise<SaveResult> {
  const body = bodyFromForm(formData);
  try {
    await apiFetch('/api/v1/meet/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
  revalidatePath('/settings');
  revalidatePath('/settings/profile');
  revalidatePath('/settings/availability');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function startGoogleAuth(): Promise<{ url?: string; error?: string }> {
  try {
    const r = await apiFetch<{ url: string }>('/api/v1/meet/google/auth-start');
    return { url: r.url };
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
}

export async function disconnectGoogle(): Promise<SaveResult> {
  try {
    await apiFetch('/api/v1/meet/google/disconnect', { method: 'POST' });
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
  revalidatePath('/settings/integrations');
  revalidatePath('/settings');
  return { ok: true };
}
