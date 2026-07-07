'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, errorMessage } from '@/lib/api';
import type {
  CertElement,
  CertOrientation,
  CertPageSize,
  CertScope,
  CertShares,
} from '@/lib/certificate-types';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createCertificateTemplate(input: {
  name: string;
  scope: CertScope;
  owner_team_id?: string | null;
}): Promise<ActionResult> {
  try {
    const created = await apiFetch<{ id: string }>('/api/v1/thread/certificate-templates', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath('/certificates');
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function updateCertificateTemplate(
  id: string,
  patch: {
    name?: string;
    page_size?: CertPageSize;
    orientation?: CertOrientation;
    background_url?: string | null;
    elements?: CertElement[];
    scope?: CertScope;
    owner_team_id?: string | null;
  },
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/certificate-templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    // The builder keeps its own client state; only the list needs refreshing.
    revalidatePath('/certificates');
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteCertificateTemplate(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/certificate-templates/${id}`, { method: 'DELETE' });
    revalidatePath('/certificates');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/** Archive (or restore) — the safe alternative when a template is in use. */
export async function archiveCertificateTemplate(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/certificate-templates/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify({ archived }),
    });
    revalidatePath('/certificates');
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/** Replace the share list (only meaningful for workspace-scoped templates). */
export async function saveCertificateShares(
  id: string,
  shares: CertShares,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/certificate-templates/${id}/shares`, {
      method: 'PUT',
      body: JSON.stringify(shares),
    });
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
