'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult = {
  ok?: boolean;
  error?: string | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
};

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

function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function updatePersonBilling(
  personId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = {
    legal_name: strOrNull(formData.get('legal_name')),
    tax_id: strOrNull(formData.get('tax_id')),
    billing_email: strOrNull(formData.get('billing_email')),
    billing_street: strOrNull(formData.get('billing_street')),
    billing_postal_code: strOrNull(formData.get('billing_postal_code')),
    billing_city: strOrNull(formData.get('billing_city')),
    billing_region: strOrNull(formData.get('billing_region')),
    billing_country: strOrNull(formData.get('billing_country'))?.toUpperCase() ?? null,
    payment_terms_days: intOrNull(formData.get('payment_terms_days')),
    currency: strOrNull(formData.get('currency'))?.toUpperCase() ?? null,
    po_required: formData.get('po_required') === 'on',
    notes: strOrNull(formData.get('notes')),
  };

  try {
    await apiFetch(`/api/v1/persons/${personId}/billing`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (e) {
    return unwrapApiError(e);
  }

  revalidatePath(`/contacts/${personId}`);
  return { ok: true };
}
