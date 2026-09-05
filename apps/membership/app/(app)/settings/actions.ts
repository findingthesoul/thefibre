'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult = { ok?: boolean; error?: string };

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
