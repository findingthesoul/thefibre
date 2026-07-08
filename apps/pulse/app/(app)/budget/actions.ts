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

export type BudgetLineInput = {
  label: string;
  category?: string | null;
  direction: 'in' | 'out';
  amount_cents: number;
  cadence: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';
  starts_on?: string | null;
  ends_on?: string | null;
  included: boolean;
  owner_user_id?: string | null;
};

export async function createBudgetLine(
  input: BudgetLineInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const r = await apiFetch<{ item: { id: string } }>('/api/v1/pulse/budget-lines', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath('/budget');
    revalidatePath('/cashflow'); // recurring lines render in the grid too
    return { ok: true, data: { id: r.item.id } };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function updateBudgetLine(
  id: string,
  patch: Partial<BudgetLineInput> & { archived?: boolean },
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/budget-lines/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath('/budget');
    revalidatePath('/cashflow'); // recurring lines render in the grid too
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}
