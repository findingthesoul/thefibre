// Platform purchase ledger — the write side. Meet + Thread call
// recordPurchase() at money events (checkout completed, mark-paid, refund);
// upsert on (app_id, item_ref) keeps every path idempotent under webhook
// retries. Reads live in routes/purchases.ts.

import { adminClient } from '../db.js';
import { settleFromPurchase } from './pulse-ledger.js';

const appIds = new Map<string, string>();
async function appId(slug: string): Promise<string | null> {
  if (appIds.has(slug)) return appIds.get(slug)!;
  const { data } = await adminClient.from('app').select('id').eq('slug', slug).maybeSingle();
  if (data) appIds.set(slug, data.id);
  return data?.id ?? null;
}

export type PurchaseWrite = {
  // 'fibre-platform' rows are the workspace's own Fibre subscription invoices
  // (routes/billing.ts webhook) — they appear in that workspace's Invoices
  // page like any other purchase, and /admin/economics sums them as platform
  // income.
  appSlug: 'the-thread' | 'fibre-meet' | 'fibre-pulse' | 'fibre-platform';
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
  method?: 'stripe' | 'invoice' | 'free';
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  stripePaymentIntent?: string | null;
  stripeInvoiceId?: string | null;
  stripeInvoiceUrl?: string | null;
  billing?: Record<string, unknown> | null;
  /** The connected account the charge runs on — stored for refunds. */
  stripeAccountId?: string | null;
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
  if (w.stripeAccountId !== undefined) row.stripe_account_id = w.stripeAccountId;
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
    // P4: a paid ledger row settles the plan it belongs to (fire-and-forget).
    else if (w.status === 'paid') void settleFromPurchase(existing.id);
  } else {
    // New rows need the not-null basics even if the caller omitted them.
    row.item_label = row.item_label ?? '';
    row.payer_name = row.payer_name ?? '';
    const { error } = await adminClient.from('purchase').insert(row);
    if (error && error.code === '23505') {
      // Lost an insert race (e.g. webhook vs enrol handler) — re-apply this
      // write as an update so the later data (paid status, PI) isn't dropped.
      const { error: retryErr } = await adminClient
        .from('purchase')
        .update(row)
        .eq('app_id', app)
        .eq('item_ref', w.itemRef);
      if (retryErr) console.error('[purchases] race-retry update failed', retryErr);
    } else if (error) {
      console.error('[purchases] insert failed', error);
    }
  }
}
