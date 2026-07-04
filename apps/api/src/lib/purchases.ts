// Platform purchase ledger — the write side. Meet + Thread call
// recordPurchase() at money events (checkout completed, mark-paid, refund);
// upsert on (app_id, item_ref) keeps every path idempotent under webhook
// retries. Reads live in routes/purchases.ts.

import { adminClient } from '../db.js';

const appIds = new Map<string, string>();
async function appId(slug: string): Promise<string | null> {
  if (appIds.has(slug)) return appIds.get(slug)!;
  const { data } = await adminClient.from('app').select('id').eq('slug', slug).maybeSingle();
  if (data) appIds.set(slug, data.id);
  return data?.id ?? null;
}

export type PurchaseWrite = {
  appSlug: 'the-thread' | 'fibre-meet';
  workspaceId: string;
  itemRef: string;
  personId?: string | null;
  payerName?: string;
  payerEmail?: string | null;
  itemLabel?: string;
  organiserUserId?: string | null;
  teamId?: string | null;
  amountCents?: number;
  currency?: string;
  platformFeeCents?: number;
  vendorShareCents?: number;
  orgShareCents?: number;
  method?: 'stripe' | 'invoice';
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  stripePaymentIntent?: string | null;
  stripeInvoiceId?: string | null;
  stripeInvoiceUrl?: string | null;
  billing?: Record<string, unknown> | null;
};

export async function recordPurchase(w: PurchaseWrite): Promise<void> {
  const app = await appId(w.appSlug);
  if (!app) {
    console.error('[purchases] unknown app slug', w.appSlug);
    return;
  }
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    workspace_id: w.workspaceId,
    app_id: app,
    item_ref: w.itemRef,
    status: w.status,
  };
  // Only send what the caller knows — upsert merges over the existing row.
  if (w.personId !== undefined) row.person_id = w.personId;
  if (w.payerName !== undefined) row.payer_name = w.payerName;
  if (w.payerEmail !== undefined) row.payer_email = w.payerEmail;
  if (w.itemLabel !== undefined) row.item_label = w.itemLabel;
  if (w.organiserUserId !== undefined) row.organiser_user_id = w.organiserUserId;
  if (w.teamId !== undefined) row.team_id = w.teamId;
  if (w.amountCents !== undefined) row.amount_cents = w.amountCents;
  if (w.currency !== undefined) row.currency = w.currency;
  if (w.platformFeeCents !== undefined) row.platform_fee_cents = w.platformFeeCents;
  if (w.vendorShareCents !== undefined) row.vendor_share_cents = w.vendorShareCents;
  if (w.orgShareCents !== undefined) row.org_share_cents = w.orgShareCents;
  if (w.method !== undefined) row.method = w.method;
  if (w.stripePaymentIntent !== undefined) row.stripe_payment_intent = w.stripePaymentIntent;
  if (w.stripeInvoiceId !== undefined) row.stripe_invoice_id = w.stripeInvoiceId;
  if (w.stripeInvoiceUrl !== undefined) row.stripe_invoice_url = w.stripeInvoiceUrl;
  if (w.billing !== undefined) row.billing = w.billing;
  if (w.status === 'paid') row.paid_at = now;
  if (w.status === 'refunded') row.refunded_at = now;

  // No upsert-with-partial-merge in PostgREST: update first, insert if new.
  const { data: existing } = await adminClient
    .from('purchase')
    .select('id')
    .eq('app_id', app)
    .eq('item_ref', w.itemRef)
    .maybeSingle();
  if (existing) {
    const { error } = await adminClient.from('purchase').update(row).eq('id', existing.id);
    if (error) console.error('[purchases] update failed', error);
  } else {
    // New rows need the not-null basics even if the caller omitted them.
    row.item_label = row.item_label ?? '';
    row.payer_name = row.payer_name ?? '';
    const { error } = await adminClient.from('purchase').insert(row);
    if (error && error.code !== '23505') console.error('[purchases] insert failed', error);
  }
}
