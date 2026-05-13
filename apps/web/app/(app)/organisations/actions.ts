'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult = {
  ok?: boolean;
  error?: string | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
};

type CreatedOrg = { id: string };

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

export async function createOrganisation(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
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
    return unwrapApiError(e);
  }

  revalidatePath('/organisations');
  redirect(`/organisations/${created.id}`);
}

export async function updateOrganisation(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const orgType = strOrNull(formData.get('org_type'));
  const sizeBand = strOrNull(formData.get('size_band'));
  const body = {
    name: strOrNull(formData.get('name')) ?? undefined,
    legal_name: strOrNull(formData.get('legal_name')),
    domain: strOrNull(formData.get('domain')),
    website: strOrNull(formData.get('website')),
    linkedin_url: strOrNull(formData.get('linkedin_url')),
    city: strOrNull(formData.get('city')),
    region: strOrNull(formData.get('region')),
    country: strOrNull(formData.get('country'))?.toUpperCase() ?? null,
    sector: strOrNull(formData.get('sector')),
    industry: strOrNull(formData.get('industry')),
    org_type: orgType,
    size_band: sizeBand,
  };

  try {
    await apiFetch(`/api/v1/organisations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return unwrapApiError(e);
  }

  revalidatePath(`/organisations/${id}`);
  revalidatePath('/organisations');
  return { ok: true };
}

export async function deleteOrganisation(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/organisations/${id}`, { method: 'DELETE' });
  } catch (e) {
    return unwrapApiError(e);
  }
  revalidatePath('/organisations');
  redirect('/organisations');
}
