'use client';

// Thin wrapper: the form itself is @thefibre/shared/ui/payments-form.
//
// This app carried its own copy until 2026-09-24 — one of four that had
// drifted apart. Thread's was design-leading (CLAUDE.md) and is what the
// shared component is built from, so porting here RESTORES what this copy had
// lost: the accounts labelled with the workspace's real name, the
// descriptions behind an ⓘ, and the VAT-on-sales controls.
//
// The strings are a typed object rather than a key lookup, because the four
// apps used DIFFERENT names for the same strings — this app's
// 'legal_name_label' is Thread's 'legal_name_on_invoices'. A `t(key)` would
// have compiled in all four and silently returned the key itself in three.

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

function strings(locale: Locale) {
  return {
    personalAccount: t(locale, 'my_account'),
    personalAccountDesc: t(locale, 'my_account_desc'),
    workspaceAccount: t(locale, 'workspace_account'),
    workspaceAccountDesc: t(locale, 'workspace_account_desc'),
    methodsHintWorkspace: t(locale, 'methods_hint_ws'),
    methodsHintPersonal: t(locale, 'methods_hint_personal'),
    managedByAdmins: t(locale, 'managed_by_admins'),
    stripeNote1: t(locale, 'stripe_footnote'),
    stripeNote2: t(locale, 'stripe_note_2'),
    whatIsThis: t(locale, 'what_is_this'),
    connected: t(locale, 'connected'),
    notConnected: t(locale, 'not_connected'),
    stripeAccountId: t(locale, 'stripe_account_id'),
    legalName: t(locale, 'legal_name_label'),
    taxNumber: t(locale, 'tax_vat_label'),
    address: t(locale, 'address_label'),
    vatOnSales: t(locale, 'vat_on_sales'),
    vatRegistered: t(locale, 'vat_registered_label'),
    rate: t(locale, 'rate'),
    vatIncludedNote: t(locale, 'vat_included_note'),
    defaultPaymentOptions: t(locale, 'default_payment_options'),
    payOnlineCard: t(locale, 'pay_online_card'),
    payPerInvoice: t(locale, 'pay_per_invoice'),
    saving: t(locale, 'saving'),
    save: t(locale, 'save'),
    saved: t(locale, 'saved_dot'),
    errAcctPrefix: t(locale, 'acct_error'),
    errKeepOneMethod: t(locale, 'keep_one_method'),
    errVatRate: t(locale, 'err_vat_rate'),
    connectStripe: t(locale, 'connect_stripe'),
    connectStripeNote: t(locale, 'connect_stripe_note'),
    opening: t(locale, 'opening'),
    stripeUnreachable: t(locale, 'stripe_unreachable'),
    stripeUnreachableNote: t(locale, 'stripe_unreachable_note'),
    stripeChargesDisabled: t(locale, 'stripe_charges_disabled'),
    errConnectFailed: t(locale, 'err_connect_failed'),
  };
}
