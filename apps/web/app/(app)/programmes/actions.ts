'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult = {
  ok?: boolean;
  error?: string | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
};

function unwrap(e: unknown): ActionResult {
  if (e instanceof ApiError) {
    const body = e.body as { error?: { fieldErrors?: Record<string, string[]> } | string; message?: string } | undefined;
    const fieldErrors = typeof body?.error === 'object' ? body.error.fieldErrors : undefined;
    const message = typeof body?.error === 'string' ? body.error : undefined;
    return { error: message ?? `API ${e.status}`, fieldErrors };
  }
  return { error: 'Unknown error' };
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

type Created = { id: string };

export async function createProgramme(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = {
    title: String(formData.get('title') ?? '').trim(),
    format: String(formData.get('format') ?? ''),
    starts_on: strOrNull(formData.get('starts_on')) ?? undefined,
    ends_on: strOrNull(formData.get('ends_on')) ?? undefined,
  };

  if (!body.title) return { error: 'Title is required.' };
  if (!body.format) return { error: 'Format is required.' };

  let created: Created;
  try {
    created = await apiFetch<Created>('/api/v1/programs', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return unwrap(e);
  }

  revalidatePath('/programmes');
  redirect(`/programmes/${created.id}`);
}

export async function enrolPerson(
  programmeId: string,
  personId: string,
  status: string,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/programs/${programmeId}/enrolments`, {
      method: 'POST',
      body: JSON.stringify({ person_id: personId, status }),
    });
  } catch (e) {
    return unwrap(e);
  }
  revalidatePath(`/programmes/${programmeId}`);
  return { ok: true };
}
