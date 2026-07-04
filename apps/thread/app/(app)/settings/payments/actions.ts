'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

type Result = { ok: true } | { ok: false; error: string };

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: unknown } | undefined;
    if (typeof body?.error === 'string') return body.error;
    return e.message;
  }
  return e instanceof Error ? e.message : 'unknown error';
}

/** Personal Stripe Connect account — lives on the organiser profile,
 *  which is also what Fibre Meet reads (one connection per person). */
export async function updateMyPayments(accountId: string | null): Promise<Result> {
  try {
    await apiFetch('/api/v1/thread/me', {
      method: 'PATCH',
      body: JSON.stringify({ stripe_account_id: accountId ?? '' }),
    });
    revalidatePath('/settings/payments');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/** Workspace Stripe Connect account — thread settings, admin-gated by RLS. */
export async function updateWorkspacePayments(accountId: string | null): Promise<Result> {
  try {
    await apiFetch('/api/v1/thread/settings', {
      method: 'PATCH',
      body: JSON.stringify({ stripe_account_id: accountId ?? '' }),
    });
    revalidatePath('/settings/payments');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
