'use server';

// Payments settings — writes the PLATFORM SPoT (Sjoerd 2026-07-04):
// personal → user_profile via /api/v1/profile; workspace → the workspace
// row via /api/v1/workspace-billing. Every app reads the same values.

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

export type InvoiceDetails = {
  legal_name?: string;
  address?: string;
  tax_no?: string;
  // Seller-side VAT: workspace default, organiser override; rates are
  // inclusive — they split the ticket price on the invoice, never add.
  vat_registered?: boolean;
  vat_rate_pct?: number | null;
};

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
    return { ok: false, error: errorMessage(e) };
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
    return { ok: false, error: errorMessage(e) };
  }
}

// --- Stripe Connect -------------------------------------------------------
// The client approves from their OWN Stripe; nobody is added by hand. Both
// of these are thin: every decision lives in routes/workspace-billing.ts.

export type StripeStatus =
  | { state: 'none'; connect_available?: boolean }
  | { state: 'connected'; chargesEnabled?: boolean; detail?: string | null; connect_available?: boolean }
  | { state: 'unreachable'; detail: string; connect_available?: boolean };

/** Does the saved account actually work? The question the old badge never
 *  asked — it reported only whether the text box was empty. */
export async function stripeStatus(): Promise<StripeStatus> {
  try {
    return await apiFetch<StripeStatus>('/api/v1/workspace-billing/stripe/status');
  } catch {
    return { state: 'none' };
  }
}

export async function startStripeConnect(): Promise<{ url?: string; error?: string }> {
  try {
    return await apiFetch<{ url: string }>('/api/v1/workspace-billing/stripe/connect');
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
