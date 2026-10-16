'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';
import type { ProductLink } from './types';

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

export type ProductInput = {
  name: string;
  currency: string;
  description: string | null;
  characteristics: string[];
  price_cents: number | null;
  purchasable: boolean;
  links: ProductLink[];
  sort_order: number;
};

export async function createProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  try {
    const r = await apiFetch<{ id: string }>('/api/v1/membership/products', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath('/products');
    return { ok: true, data: { id: r.id } };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// Also carries archive/unarchive — PATCH {archived} flips archived_at server-side.
export async function patchProduct(
  id: string,
  input: Partial<ProductInput> & { archived?: boolean; group_id?: string | null },
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/membership/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    revalidatePath('/products');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// PRODUCT GROUPS (2026-10-16) — organising only.
export type ProductGroup = { id: string; name: string; sort_order: number; archived_at: string | null };

export async function createProductGroup(name: string): Promise<ActionResult<ProductGroup>> {
  try {
    const g = await apiFetch<ProductGroup>('/api/v1/membership/product-groups', { method: 'POST', body: JSON.stringify({ name }) });
    revalidatePath('/products');
    return { ok: true, data: g };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function patchProductGroup(id: string, input: { name?: string; archived?: boolean }): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/membership/product-groups/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
    revalidatePath('/products');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function orderProductGroups(ids: string[]): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/membership/product-groups/order', { method: 'PUT', body: JSON.stringify({ ids }) });
    revalidatePath('/products');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}
