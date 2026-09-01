'use server';

import { apiFetch, ApiError } from '@/lib/api';

export type BillingActionResult = { url?: string; error?: string; usePortal?: boolean };

function message(e: unknown): string {
  if (e instanceof ApiError) {
    const detail =
      typeof e.body === 'object' && e.body && 'error' in e.body
        ? String((e.body as { error: unknown }).error)
        : '';
    return detail || `API ${e.status}`;
  }
  return 'unknown error';
}

export async function startCheckout(
  planId: string,
  interval: 'monthly' | 'annual',
): Promise<BillingActionResult> {
  try {
    const r = await apiFetch<{ url: string }>('/api/v1/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId, interval }),
    });
    return { url: r.url };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409 && typeof e.body === 'object' && e.body && 'use_portal' in e.body) {
      return { usePortal: true };
    }
    return { error: message(e) };
  }
}

export async function openPortal(): Promise<BillingActionResult> {
  try {
    const r = await apiFetch<{ url: string }>('/api/v1/billing/portal', { method: 'POST' });
    return { url: r.url };
  } catch (e) {
    return { error: message(e) };
  }
}
