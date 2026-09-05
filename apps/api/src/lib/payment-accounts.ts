// Payment settings SPoT — the ONE resolution order every reader uses
// (Sjoerd 2026-07-04). Settings pages write the platform tables; the old
// app-local columns remain read fallbacks for rows never migrated.

import { adminClient } from '../db.js';
import { billingFor } from './identity-profile.js';

export type InvoiceDetails = {
  legal_name?: string;
  address?: string;
  tax_no?: string;
  // Seller-side VAT on sales (lib/seller-vat.ts): workspace default,
  // organiser override. Rates are inclusive — they split, never add.
  vat_registered?: boolean;
  vat_rate_pct?: number | null;
} | null;

/**
 * Personal Stripe Connect account:
 * identity_billing → user_profile → thread_organiser → meet_host.
 *
 * identity_billing is keyed by email, so the account follows the person
 * between workspaces rather than being re-connected per seat
 * (20260901160000). The three behind it are read fallbacks, oldest last.
 */
export async function personalStripeAccount(userId: string): Promise<string | null> {
  const billing = await billingFor(userId);
  if (billing.stripe_account_id) return billing.stripe_account_id;
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
  const billing = await billingFor(userId);
  if (billing.invoice_details) return billing.invoice_details as InvoiceDetails;
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
  const billing = await billingFor(userId);
  if (billing.default_payment_methods?.length) {
    return billing.default_payment_methods as ('stripe' | 'invoice')[];
  }
  const { data: p } = await adminClient
    .from('user_profile')
    .select('default_payment_methods')
    .eq('user_id', userId)
    .maybeSingle();
  const m = p?.default_payment_methods as ('stripe' | 'invoice')[] | null | undefined;
  return m && m.length ? m : ['stripe'];
}

/** Workspace-level default payment methods — the root for team/workspace-
 *  destination threads. Falls back to {stripe}. */
export async function workspaceDefaultPaymentMethods(
  workspaceId: string,
): Promise<('stripe' | 'invoice')[]> {
  const { data: w } = await adminClient
    .from('workspace')
    .select('default_payment_methods')
    .eq('id', workspaceId)
    .maybeSingle();
  const m = w?.default_payment_methods as ('stripe' | 'invoice')[] | null | undefined;
  return m && m.length ? m : ['stripe'];
}

/** Where a THREAD's money lands, honouring the team's payout choice:
 *  personal thread → organiser's account; team thread → the workspace
 *  account, unless the team routes to its lead's personal account. */
export async function threadDestinationAccount(thread: {
  workspace_id: string;
  team_id?: string | null | undefined;
  payment_destination?: string | null | undefined;
  organiser_user_id?: string | null | undefined;
}): Promise<string | null> {
  if (thread.payment_destination === 'personal') {
    return thread.organiser_user_id ? personalStripeAccount(thread.organiser_user_id) : null;
  }
  if (thread.team_id) {
    const { data: team } = await adminClient
      .from('team')
      .select('payout_destination')
      .eq('id', thread.team_id)
      .maybeSingle();
    if (team?.payout_destination === 'lead') {
      const { data: lead } = await adminClient
        .from('team_member')
        .select('user_id')
        .eq('team_id', thread.team_id)
        .eq('role', 'lead')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (lead?.user_id) return personalStripeAccount(lead.user_id);
    }
  }
  return workspaceStripeAccount(thread.workspace_id);
}

/** ticket ?? thread ?? account default ?? {stripe} — the inheritance chain.
 *  The account root is the WORKSPACE default for team/workspace-destination
 *  threads, the organiser's personal default otherwise. */
export async function resolvePaymentMethods(opts: {
  ticketMethods?: string[] | null;
  threadMethods?: string[] | null;
  organiserUserId?: string | null;
  workspaceId?: string | null;
  workspaceRoot?: boolean;
}): Promise<('stripe' | 'invoice')[]> {
  if (opts.ticketMethods?.length) return opts.ticketMethods as ('stripe' | 'invoice')[];
  if (opts.threadMethods?.length) return opts.threadMethods as ('stripe' | 'invoice')[];
  if (opts.workspaceRoot && opts.workspaceId) {
    return workspaceDefaultPaymentMethods(opts.workspaceId);
  }
  if (opts.organiserUserId) return defaultPaymentMethods(opts.organiserUserId);
  return ['stripe'];
}

/** The connected account a purchase's charge runs on (by app source row). */
export async function chargeAccountForItem(
  appSlug: string,
  itemRef: string,
): Promise<string | null> {
  if (appSlug === 'membership') {
    // Membership charges always run on the WORKSPACE account; the purchase
    // row itself knows the workspace, whatever shape its item_ref has.
    const { data: app } = await adminClient
      .from('app')
      .select('id')
      .eq('slug', 'membership')
      .maybeSingle();
    if (!app) return null;
    const { data: row } = await adminClient
      .from('purchase')
      .select('workspace_id')
      .eq('app_id', app.id)
      .eq('item_ref', itemRef)
      .maybeSingle();
    return row ? workspaceStripeAccount(row.workspace_id) : null;
  }
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
      `workspace_id, thread:thread_id (team_id, payment_destination, organiser:organiser_id (user_id))`,
    )
    .eq('id', itemRef)
    .maybeSingle();
  if (!te) return null;
  const thread = Array.isArray(te.thread) ? te.thread[0] : te.thread;
  if (!thread) return null;
  const org = Array.isArray(thread.organiser) ? thread.organiser[0] : thread.organiser;
  // Same routing as the original checkout — incl. team payout_destination
  // 'lead' (review 2026-07-05: payment links charged the workspace account
  // for lead-payout team threads).
  return threadDestinationAccount({
    workspace_id: te.workspace_id,
    team_id: (thread as { team_id?: string | null }).team_id ?? null,
    payment_destination: thread.payment_destination ?? null,
    organiser_user_id: org?.user_id ?? null,
  });
}
