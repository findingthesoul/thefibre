'use client';

// Thin wrapper: the form itself is @thefibre/shared/ui/payments-form.
//
// This file WAS the implementation, and the other three apps carried ports of
// it that had drifted — they lost `workspaceName` (so the accounts read
// "Workspace account" instead of the workspace's real name) and lost the ⓘ.
// Extracted 2026-09-24 with this version as the base, because CLAUDE.md names
// Thread design-leading and because the Stripe Connect flow was about to be
// written four times otherwise.
//
// What stays app-bound: this app's server actions, its router, and its own
// i18n catalog. The strings are passed as a typed object rather than a key
// lookup — the four apps used DIFFERENT key names for the same strings, so a
// `t(key)` would have compiled everywhere and silently returned the key
// itself in three of them.

import { useRouter } from 'next/navigation';
import type { Locale } from '@thefibre/shared';
import {
  PaymentsForm as SharedPaymentsForm,
  type InvoiceDetails,
  type PaymentMethod,
} from '@thefibre/shared/ui/payments-form';
import {
  startStripeConnect,
  stripeStatus,
  updateMyPayments,
  updateWorkspacePayments,
} from './actions';
import { t } from '@/lib/i18n-ui';

export function PaymentsForm({
  locale,
  personalAccount,
  personalDetails,
  personalMethods,
  workspaceAccount,
  workspaceDetails,
  workspaceMethods,
  isAdmin,
  workspaceName = null,
}: {
  locale: Locale;
  personalAccount: string | null;
  personalDetails: InvoiceDetails | null;
  personalMethods: PaymentMethod[] | null;
  workspaceAccount: string | null;
  workspaceDetails: InvoiceDetails | null;
  workspaceMethods: PaymentMethod[] | null;
  isAdmin: boolean;
  workspaceName?: string | null;
}) {
  const router = useRouter();
  return (
    <SharedPaymentsForm
      s={strings(locale)}
      personalAccount={personalAccount}
      personalDetails={personalDetails}
      personalMethods={personalMethods}
      workspaceAccount={workspaceAccount}
      workspaceDetails={workspaceDetails}
      workspaceMethods={workspaceMethods}
      isAdmin={isAdmin}
      workspaceName={workspaceName}
      onSaved={() => router.refresh()}
      savePersonal={(a, d, m) => updateMyPayments(a, d, m)}
      saveWorkspace={(a, d, m) => updateWorkspacePayments(a, d, m)}
      loadWorkspaceStripeStatus={stripeStatus}
      startWorkspaceStripeConnect={startStripeConnect}
    />
  );
}


export function strings(locale: Locale) {
  return {
    personalAccount: t(locale, 'personal_account'),
    personalAccountDesc: t(locale, 'my_account_desc'),
    workspaceAccount: t(locale, 'workspace_account'),
    workspaceAccountDesc: t(locale, 'workspace_account_desc'),
    methodsHintWorkspace: t(locale, 'methods_hint_workspace'),
    methodsHintPersonal: t(locale, 'methods_hint_personal'),
    managedByAdmins: t(locale, 'managed_by_admins'),
    stripeNote1: t(locale, 'stripe_note_1'),
    stripeNote2: t(locale, 'stripe_note_2'),
    whatIsThis: t(locale, 'what_is_this'),
    connected: t(locale, 'connected'),
    notConnected: t(locale, 'not_connected'),
    stripeAccountId: t(locale, 'stripe_account_id'),
    legalName: t(locale, 'legal_name_on_invoices'),
    taxNumber: t(locale, 'tax_vat_number'),
    address: t(locale, 'address_on_invoices'),
    vatOnSales: t(locale, 'vat_on_sales'),
    vatRegistered: t(locale, 'vat_registered_label'),
    rate: t(locale, 'rate'),
    vatIncludedNote: t(locale, 'vat_included_note'),
    defaultPaymentOptions: t(locale, 'default_payment_options'),
    payOnlineCard: t(locale, 'pay_online_card'),
    payPerInvoice: t(locale, 'pay_per_invoice'),
    saving: t(locale, 'saving'),
    save: t(locale, 'save'),
    saved: t(locale, 'saved'),
    errAcctPrefix: t(locale, 'err_acct_prefix'),
    errKeepOneMethod: t(locale, 'err_keep_one_method'),
    errVatRate: t(locale, 'err_vat_rate'),
    connectStripe: t(locale, 'connect_stripe'),
    connectStripeChange: t(locale, 'connect_stripe_change'),
    connectStripeNote: t(locale, 'connect_stripe_note'),
    opening: t(locale, 'opening'),
    stripeUnreachable: t(locale, 'stripe_unreachable'),
    stripeUnreachableNote: t(locale, 'stripe_unreachable_note'),
    stripeChargesDisabled: t(locale, 'stripe_charges_disabled'),
    errConnectFailed: t(locale, 'err_connect_failed'),
  };
}
