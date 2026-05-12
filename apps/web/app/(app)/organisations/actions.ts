'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

type CreateResult = {
  error?: string | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
};

type CreatedOrg = { id: string };

export async function createOrganisation(
  _prev: CreateResult,
  formData: FormData,
): Promise<CreateResult> {
  const body = {
    name: String(formData.get('name') ?? '').trim(),
    domain: String(formData.get('domain') ?? '').trim() || undefined,
    country: String(formData.get('country') ?? '').trim().toUpperCase() || undefined,
    sector: String(formData.get('sector') ?? '').trim() || undefined,
    org_type: (String(formData.get('org_type') ?? '').trim() || undefined) as
      | 'private' | 'public' | 'ngo' | 'cooperative' | 'government' | 'education' | undefined,
  };

  if (!body.name) {
    return { error: 'Name is required.' };
  }

  let created: CreatedOrg;
  try {
    created = await apiFetch<CreatedOrg>('/api/v1/organisations', {
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

  revalidatePath('/organisations');
  redirect(`/organisations/${created.id}`);
}
