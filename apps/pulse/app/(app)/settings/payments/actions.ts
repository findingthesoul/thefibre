'use server';

// Payments settings — writes the PLATFORM SPoT (Sjoerd 2026-07-04):
// personal → user_profile via /api/v1/profile; workspace → the workspace
// row via /api/v1/workspace-billing. Every app reads the same values.
// Ported from The Thread's settings/payments actions; only the error
// formatter differs (Pulse's lib/api has no errorMessage helper).

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

type Result = { ok: true } | { ok: false; error: string };

export type InvoiceDetails = { legal_name?: string; address?: string; tax_no?: string };

function formatApiError(e: unknown): string {
  if (!(e instanceof ApiError)) return 'unknown error';
  const body = e.body as { error?: unknown } | undefined;
  const raw = body?.error;
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

export async function updateMyPayments(
  accountId: string | null,
  invoiceDetails: InvoiceDetails | null,
  defaultMethods: ('stripe' | 'invoice')[] | null,
): Promise<Result> {
  try {
    await apiFetch('/api/v1/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        stripe_account_id: accountId ?? '',
        invoice_details: invoiceDetails,
        default_payment_methods: defaultMethods,
      }),
    });
    revalidatePath('/settings/payments');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: formatApiError(e) };
  }
}

export async function updateWorkspacePayments(
  accountId: string | null,
  invoiceDetails: InvoiceDetails | null,
  defaultMethods: ('stripe' | 'invoice')[] | null,
): Promise<Result> {
  try {
    await apiFetch('/api/v1/workspace-billing', {
      method: 'PATCH',
      body: JSON.stringify({
        stripe_account_id: accountId ?? '',
        invoice_details: invoiceDetails,
        default_payment_methods: defaultMethods,
      }),
    });
    revalidatePath('/settings/payments');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: formatApiError(e) };
  }
}
