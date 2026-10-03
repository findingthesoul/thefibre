'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult<T = unknown> = { ok?: boolean; error?: string; data?: T };

function formatApiError(e: unknown): string {
  if (!(e instanceof ApiError)) return 'unknown error';
  const body = e.body as { error?: unknown; details?: unknown; code?: string } | undefined;
  const raw = body?.error ?? body?.details ?? body?.code;
  let detail: string | undefined;
  if (typeof raw === 'string') detail = raw;
  else if (raw && typeof raw === 'object') {
    try {
      detail = JSON.stringify(raw);
    } catch {
      /* ignore */
    }
  }
  return detail ? `API ${e.status}: ${detail}` : `API ${e.status}`;
}

async function putSettings(patch: Record<string, unknown>): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/membership/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// join_page is stored whole — the caller merges into the fetched object so
// keys this card doesn't know about survive the save. `locale` is its own
// settings column (the public page language), saved in the same PUT.
export async function saveJoinPage(
  joinPage: Record<string, unknown>,
  locale?: string,
): Promise<ActionResult> {
  return putSettings({ join_page: joinPage, ...(locale ? { locale } : {}) });
}

export async function saveCircle(input: {
  circle_community_url: string | null;
  // undefined = keep the stored token; null = remove it; string = replace it.
  circle_api_token?: string | null;
}): Promise<ActionResult> {
  return putSettings({
    circle_community_url: input.circle_community_url,
    ...(input.circle_api_token !== undefined
      ? { circle_api_token: input.circle_api_token }
      : {}),
  });
}

// Google Workspace integration credential — same undefined/null/string
// contract as the Circle token.
export async function saveGoogle(input: {
  google_admin_email: string | null;
  google_sa_json?: string | null;
}): Promise<ActionResult> {
  return putSettings({
    google_admin_email: input.google_admin_email,
    ...(input.google_sa_json !== undefined ? { google_sa_json: input.google_sa_json } : {}),
  });
}

// Currency SPoT lives on the WORKSPACE (platform endpoint), not membership
// settings — one list for everything the workspace prices.
export async function saveCurrencies(input: {
  default_currency: string;
  currencies: string[];
}): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/workspace', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}


// Fibre-seat policy (2026-09-05): approve-or-auto + the standing consent
// for billed seats. Lives on the Integrations page — the built-in
// integration's own settings.
export async function saveSeatPolicy(input: {
  fibre_seat_mode: 'auto' | 'approve';
  allow_billed_seats: boolean;
}): Promise<ActionResult> {
  return putSettings(input);
}

// ── member directory (docs/member-directory-spec.md slice 1) ──────────────
//
// The four workspace switches. `directory_default_category_id` is the one
// that names another row, and the API re-checks it belongs to this
// workspace: a foreign key proves a category exists, not that it is ours.

export async function saveDirectorySettings(input: {
  directory_visibility: 'everybody' | 'category';
  directory_show_contact: boolean;
  directory_show_category: boolean;
  directory_default_category_id: string | null;
}): Promise<ActionResult> {
  const r = await putSettings(input);
  revalidatePath('/settings/directory');
  return r;
}

export async function createCategory(name: string): Promise<ActionResult<{ id: string }>> {
  try {
    const r = await apiFetch<{ id: string }>('/api/v1/membership/directory/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    revalidatePath('/settings/directory');
    return { ok: true, data: { id: r.id } };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

/** Rename, reorder or archive. Archive rather than delete: a category that
 *  products still carry would otherwise take their categorisation with it,
 *  and §9.3 then silently drops those members out of the directory. */
export async function patchCategory(
  id: string,
  input: { name?: string; sort_order?: number; archived?: boolean },
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/membership/directory/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    revalidatePath('/settings/directory');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

/** Replace-in-full: the editor shows a set of checkboxes and saves a set. */
export async function setProductCategories(
  productId: string,
  categoryIds: string[],
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/membership/products/${productId}/categories`, {
      method: 'PUT',
      body: JSON.stringify({ category_ids: categoryIds }),
    });
    revalidatePath('/products');
    revalidatePath('/settings/directory');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}
