'use server';

// Server actions for the Invoices area — thin wrappers over the platform
// purchases API (docs/invoices-and-roles-proposal.md).

import { apiFetch, errorMessage } from '@/lib/api';
import type { Billing } from '@/lib/thread-types';

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

async function post(id: string, action: string): Promise<SimpleResult> {
  try {
    await apiFetch(`/api/v1/purchases/${id}/${action}`, { method: 'POST' });
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

export async function markPurchasePaid(id: string): Promise<SimpleResult> {
  return post(id, 'mark-paid');
}

/** Invoice-method + pending: email the payer a Stripe payment link. */
export async function sendPaymentLink(id: string): Promise<SimpleResult> {
  return post(id, 'send-payment-link');
}

/** Email the invoice/receipt to any address (the shared invoice dialog). */
export async function emailInvoice(id: string, to: string): Promise<SimpleResult> {
  try {
    await apiFetch(`/api/v1/purchases/${encodeURIComponent(id)}/resend-invoice`, {
      method: 'POST',
      body: JSON.stringify({ to }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
