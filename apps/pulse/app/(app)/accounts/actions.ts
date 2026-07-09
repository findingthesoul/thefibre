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

export async function createAccount(input: {
  name: string;
  kind: 'bank' | 'reserve';
  parent_account_id?: string | null;
  // Scope (accounts are per-cashflow-tab now): null/null = workspace bank;
  // a team's virtual bank; or a personal one. The API's RLS decides access.
  team_id?: string | null;
  owner_user_id?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const r = await apiFetch<{ item: { id: string } }>('/api/v1/pulse/accounts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath('/accounts');
    revalidatePath('/cashflow'); // the BANK section's per-tab create prompt
    return { ok: true, data: { id: r.item.id } };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function updateAccount(
  id: string,
  patch: {
    name?: string;
    kind?: 'bank' | 'reserve';
    parent_account_id?: string | null;
    // Cashflow reassignment — same scope semantics as createAccount.
    team_id?: string | null;
    owner_user_id?: string | null;
  },
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath('/accounts');
    revalidatePath('/cashflow'); // reassignment moves it between tabs' BANK sections
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function archiveAccount(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ archived: true }),
    });
    revalidatePath('/accounts');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

/** The Monday ritual — one snapshot POST per touched account. Snapshots are
 *  append-only on the API side; each save adds a row, history is kept. */
export async function recordSnapshots(
  asOfDate: string,
  entries: { account_id: string; name: string; balance_cents: number }[],
): Promise<ActionResult> {
  for (const entry of entries) {
    try {
      await apiFetch(`/api/v1/pulse/accounts/${entry.account_id}/snapshots`, {
        method: 'POST',
        body: JSON.stringify({ balance_cents: entry.balance_cents, as_of_date: asOfDate }),
      });
    } catch (e) {
      revalidatePath('/accounts'); // some may have landed already
      return { error: `${entry.name}: ${formatApiError(e)}` };
    }
  }
  revalidatePath('/accounts');
  return { ok: true };
}
