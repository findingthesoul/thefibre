'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

type CreateResult = {
  error?: string | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
};

type CreatedPerson = { id: string };

export async function createPerson(
  _prev: CreateResult,
  formData: FormData,
): Promise<CreateResult> {
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
    if (e instanceof ApiError) {
      const apiBody = e.body as { error?: { fieldErrors?: Record<string, string[]> } } | undefined;
      return {
        error: `API ${e.status}`,
        fieldErrors: apiBody?.error?.fieldErrors,
      };
    }
    return { error: 'Unknown error' };
  }

  revalidatePath('/contacts');
  redirect(`/contacts/${created.id}`);
}
