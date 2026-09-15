'use server';

// Server actions behind a contact's Invoices tab (2026-09-14).
//
// The same thin wrappers over the platform purchases API that Thread, Meet
// and Membership use for their Invoices pages — the app-bound half of THE
// shared invoices area (@thefibre/shared/ui/invoices). They add one thing:
// `personId` (a contact's tab) or `orgId` (an organisation's tab, which uses
// these same actions), narrowing every list to those rows. Resend, email,
// mark-paid, refund and payment links are the same calls as everywhere, so a
// resend from a contact is the resend, not a second one.

import { apiFetch, errorMessage } from '@/lib/api';
import type { ListPurchasesArgs, PurchaseList } from '@thefibre/shared/ui/invoices';

type SimpleResult = { ok: true } | { ok: false; error: string };

export async function listPurchases(params: ListPurchasesArgs) {
  const qs = new URLSearchParams({ scope: params.scope });
  if (params.teamId) qs.set('team_id', params.teamId);
  if (params.q) qs.set('q', params.q);
  if (params.app) qs.set('app', params.app);
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.personId) qs.set('person_id', params.personId);
  if (params.orgId) qs.set('org_id', params.orgId);
  try {
    const data = await apiFetch<PurchaseList>(`/api/v1/purchases?${qs.toString()}`);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}

async function post(id: string, action: string): Promise<SimpleResult> {
  try {
    await apiFetch(`/api/v1/purchases/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
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

export async function sendPaymentLink(id: string): Promise<SimpleResult> {
  return post(id, 'send-payment-link');
}

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
