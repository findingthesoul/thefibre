'use server';

// Server actions for the Invoices area — thin wrappers over the platform
// purchases API (docs/invoices-and-roles-proposal.md). Copied from The
// Thread's invoices lane (the established pattern — Thread's and Meet's
// copies are near-identical); Pulse-specific: mark-paid carries an optional
// paid date + receiving account so the API can snapshot the balance and
// settle the matching plan line.

import { apiFetch, ApiError } from '@/lib/api';

/** Invoice billing details captured at enrolment (shape shared with the API). */
export type Billing = {
  company?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  tax_no?: string;
};

export type PurchaseRow = {
  id: string;
  app: { slug: string; name: string } | { slug: string; name: string }[] | null;
  payer_name: string;
  payer_email: string | null;
  item_label: string;
  item_ref: string;
  organiser_user_id: string | null;
  team_id: string | null;
  amount_cents: number;
  currency: string;
  platform_fee_cents: number;
  vendor_share_cents: number;
  org_share_cents: number;
  method: 'stripe' | 'invoice' | 'free';
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  stripe_invoice_url: string | null;
  billing?: Billing | null;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
};

export type CurrencyTotals = {
  currency: string;
  paid_cents: number;
  pending_cents: number;
  refunded_cents: number;
  fees_cents: number;
};

export type PurchaseTotals = {
  count: number;
  currencies: CurrencyTotals[];
};

export type PurchaseList = {
  items: PurchaseRow[];
  next_cursor: string | null;
  totals: PurchaseTotals;
  role: string;
};

// Human-readable message from a failed API call. Pulse's lib/api doesn't
// ship Thread's errorMessage helper, so it lives here.
function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: unknown } | undefined;
    if (typeof body?.error === 'string') return body.error;
    if (body?.error) return JSON.stringify(body.error);
    return e.message;
  }
  return e instanceof Error ? e.message : 'unknown error';
}

export async function listPurchases(params: {
  scope: 'me' | 'team' | 'workspace';
  teamId?: string | null;
  q?: string;
  app?: string;
  cursor?: string | null;
}): Promise<{ ok: true; data: PurchaseList } | { ok: false; error: string }> {
  const qs = new URLSearchParams({ scope: params.scope });
  if (params.teamId) qs.set('team_id', params.teamId);
  if (params.q) qs.set('q', params.q);
  if (params.app) qs.set('app', params.app);
  if (params.cursor) qs.set('cursor', params.cursor);
  try {
    const data = await apiFetch<PurchaseList>(`/api/v1/purchases?${qs.toString()}`);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

type SimpleResult = { ok: true } | { ok: false; error: string };

async function post(id: string, action: string, body?: unknown): Promise<SimpleResult> {
  try {
    await apiFetch(`/api/v1/purchases/${id}/${action}`, {
      method: 'POST',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function resendInvoice(id: string): Promise<SimpleResult> {
  return post(id, 'resend-invoice');
}

export async function refundPurchase(id: string): Promise<SimpleResult> {
  return post(id, 'refund');
}

/** Mark an invoice-method purchase paid, with the paid date and (optionally)
 *  the bank account the money landed on — the API adds a balance snapshot on
 *  that account and settles the matching plan line. */
export async function markPurchasePaid(
  id: string,
  input: { paid_date: string; account_id?: string },
): Promise<SimpleResult> {
  return post(id, 'mark-paid', {
    paid_date: input.paid_date,
    ...(input.account_id ? { account_id: input.account_id } : {}),
  });
}

/** Invoice-method + pending: email the payer a Stripe payment link. */
export async function sendPaymentLink(id: string): Promise<SimpleResult> {
  return post(id, 'send-payment-link');
}
