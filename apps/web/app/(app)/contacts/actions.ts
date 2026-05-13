'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult = {
  ok?: boolean;
  error?: string | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
};

type CreatedPerson = { id: string };

function unwrapApiError(e: unknown): ActionResult {
  if (e instanceof ApiError) {
    const apiBody = e.body as { error?: { fieldErrors?: Record<string, string[]> } } | undefined;
    return { error: `API ${e.status}`, fieldErrors: apiBody?.error?.fieldErrors };
  }
  return { error: 'Unknown error' };
}

export async function createPerson(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = {
    first_name: String(formData.get('first_name') ?? '').trim(),
    last_name: String(formData.get('last_name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    country: String(formData.get('country') ?? '').trim().toUpperCase() || undefined,
  };

  if (!body.first_name || !body.last_name || !body.email) {
    return { error: 'First name, last name, and email are required.' };
  }

  let created: CreatedPerson;
  try {
    created = await apiFetch<CreatedPerson>('/api/v1/persons', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return unwrapApiError(e);
  }

  revalidatePath('/contacts');
  redirect(`/contacts/${created.id}`);
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

export async function updatePerson(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = {
    first_name: strOrNull(formData.get('first_name')) ?? undefined,
    last_name: strOrNull(formData.get('last_name')) ?? undefined,
    preferred_name: strOrNull(formData.get('preferred_name')),
    pronouns: strOrNull(formData.get('pronouns')),
    email: strOrNull(formData.get('email')) ?? undefined,
    phone: strOrNull(formData.get('phone')),
    linkedin_url: strOrNull(formData.get('linkedin_url')),
    city: strOrNull(formData.get('city')),
    region: strOrNull(formData.get('region')),
    country: strOrNull(formData.get('country'))?.toUpperCase() ?? null,
  };

  try {
    await apiFetch(`/api/v1/persons/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return unwrapApiError(e);
  }

  revalidatePath(`/contacts/${id}`);
  revalidatePath('/contacts');
  return { ok: true };
}

export async function deletePerson(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/persons/${id}`, { method: 'DELETE' });
  } catch (e) {
    return unwrapApiError(e);
  }
  revalidatePath('/contacts');
  redirect('/contacts');
}
