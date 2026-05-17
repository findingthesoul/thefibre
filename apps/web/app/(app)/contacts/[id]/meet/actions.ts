'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult = {
  ok?: boolean;
  error?: string | undefined;
};

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

function unwrapError(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Unknown error';
  const body = e.body as { error?: unknown } | undefined;
  const raw = body?.error;
  if (typeof raw === 'string') return `API ${e.status}: ${raw}`;
  return `API ${e.status}`;
}

export async function updateMeetProfile(
  personId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = {
    host_notes: strOrNull(formData.get('host_notes')),
    vip: formData.get('vip') === 'on',
    blocked: formData.get('blocked') === 'on',
    invitee_timezone: strOrNull(formData.get('invitee_timezone')),
  };
  try {
    await apiFetch(`/api/v1/persons/${personId}/meet`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { error: unwrapError(e) };
  }
  revalidatePath(`/contacts/${personId}`);
  revalidatePath(`/contacts/${personId}/app/fibre-meet`);
  return { ok: true };
}
