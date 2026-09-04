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

export async function switchPlan(
  planId: string,
  interval: 'monthly' | 'annual',
): Promise<BillingActionResult> {
  try {
    await apiFetch('/api/v1/billing/switch', {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId, interval }),
    });
    return {};
  } catch (e) {
    return { error: message(e) };
  }
}

export async function cancelPlan(): Promise<BillingActionResult> {
  try {
    await apiFetch('/api/v1/billing/cancel', { method: 'POST' });
    return {};
  } catch (e) {
    return { error: message(e) };
  }
}

export async function resumePlan(): Promise<BillingActionResult> {
  try {
    await apiFetch('/api/v1/billing/resume', { method: 'POST' });
    return {};
  } catch (e) {
    return { error: message(e) };
  }
}

/** Email an invoice/receipt to any address (the shared invoice dialog). */
export async function emailInvoice(id: string, to: string): Promise<BillingActionResult> {
  try {
    await apiFetch(`/api/v1/purchases/${encodeURIComponent(id)}/resend-invoice`, {
      method: 'POST',
      body: JSON.stringify({ to }),
    });
    return {};
  } catch (e) {
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
