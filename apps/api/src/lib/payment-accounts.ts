// Payment settings SPoT — the ONE resolution order every reader uses
// (Sjoerd 2026-07-04). Settings pages write the platform tables; the old
// app-local columns remain read fallbacks for rows never migrated.

import { adminClient } from '../db.js';

export type InvoiceDetails = {
  legal_name?: string;
  address?: string;
  tax_no?: string;
} | null;

/** Personal Stripe Connect account: user_profile → thread_organiser → meet_host. */
export async function personalStripeAccount(userId: string): Promise<string | null> {
  const { data: p } = await adminClient
    .from('user_profile')
    .select('stripe_account_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (p?.stripe_account_id) return p.stripe_account_id;
  const { data: t } = await adminClient
    .from('thread_organiser')
    .select('stripe_account_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (t?.stripe_account_id) return t.stripe_account_id;
  const { data: m } = await adminClient
    .from('meet_host')
    .select('stripe_account_id')
    .eq('user_id', userId)
    .maybeSingle();
  return m?.stripe_account_id ?? null;
}

/** Workspace Stripe Connect account: workspace → thread_settings. */
export async function workspaceStripeAccount(workspaceId: string): Promise<string | null> {
  const { data: w } = await adminClient
    .from('workspace')
    .select('stripe_account_id')
    .eq('id', workspaceId)
    .maybeSingle();
  if (w?.stripe_account_id) return w.stripe_account_id;
  const { data: ts } = await adminClient
    .from('thread_settings')
    .select('stripe_account_id')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return ts?.stripe_account_id ?? null;
}

/** Invoice issuer identity, personal level (workspace as caller fallback). */
export async function personalInvoiceDetails(userId: string): Promise<InvoiceDetails> {
  const { data: p } = await adminClient
    .from('user_profile')
    .select('invoice_details')
    .eq('user_id', userId)
    .maybeSingle();
  if (p?.invoice_details) return p.invoice_details as InvoiceDetails;
  const { data: t } = await adminClient
    .from('thread_organiser')
    .select('invoice_details')
    .eq('user_id', userId)
    .maybeSingle();
  return (t?.invoice_details as InvoiceDetails) ?? null;
}

export async function workspaceInvoiceDetails(workspaceId: string): Promise<InvoiceDetails> {
  const { data: w } = await adminClient
    .from('workspace')
    .select('invoice_details')
    .eq('id', workspaceId)
    .maybeSingle();
  if (w?.invoice_details) return w.invoice_details as InvoiceDetails;
  const { data: ts } = await adminClient
    .from('thread_settings')
    .select('invoice_details')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return (ts?.invoice_details as InvoiceDetails) ?? null;
}

/** Account-level default payment methods (inheritance root). */
export async function defaultPaymentMethods(userId: string): Promise<('stripe' | 'invoice')[]> {
  const { data: p } = await adminClient
    .from('user_profile')
    .select('default_payment_methods')
    .eq('user_id', userId)
    .maybeSingle();
  const m = p?.default_payment_methods as ('stripe' | 'invoice')[] | null | undefined;
  return m && m.length ? m : ['stripe'];
}

/** ticket ?? thread ?? account default ?? {stripe} — the inheritance chain. */
export async function resolvePaymentMethods(opts: {
  ticketMethods?: string[] | null;
  threadMethods?: string[] | null;
  organiserUserId?: string | null;
}): Promise<('stripe' | 'invoice')[]> {
  if (opts.ticketMethods?.length) return opts.ticketMethods as ('stripe' | 'invoice')[];
  if (opts.threadMethods?.length) return opts.threadMethods as ('stripe' | 'invoice')[];
  if (opts.organiserUserId) return defaultPaymentMethods(opts.organiserUserId);
  return ['stripe'];
}

/** The connected account a purchase's charge runs on (by app source row). */
export async function chargeAccountForItem(
  appSlug: string,
  itemRef: string,
): Promise<string | null> {
  if (appSlug === 'fibre-meet') {
    const { data: b } = await adminClient
      .from('meet_booking')
      .select('host:host_id (user_id, stripe_account_id)')
      .eq('id', itemRef)
      .maybeSingle();
    const host = b && (Array.isArray(b.host) ? b.host[0] : b.host);
    if (host?.user_id) return personalStripeAccount(host.user_id);
    return host?.stripe_account_id ?? null;
  }
  const { data: te } = await adminClient
    .from('thread_enrolment')
    .select(
      `workspace_id, thread:thread_id (payment_destination, organiser:organiser_id (user_id))`,
    )
    .eq('id', itemRef)
    .maybeSingle();
  if (!te) return null;
  const thread = Array.isArray(te.thread) ? te.thread[0] : te.thread;
  if (!thread) return null;
  if (thread.payment_destination === 'personal') {
    const org = Array.isArray(thread.organiser) ? thread.organiser[0] : thread.organiser;
    return org?.user_id ? personalStripeAccount(org.user_id) : null;
  }
  return workspaceStripeAccount(te.workspace_id);
}
