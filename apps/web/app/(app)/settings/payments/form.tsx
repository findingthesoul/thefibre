'use client';

// Thin wrapper: the form is @thefibre/shared/ui/payments-form and the copy is
// @thefibre/shared/payments-i18n.
//
// The Fibre is the fifth app to show this page and the first not to carry its
// own copy of the 37 strings. It is also the app where the values actually
// LIVE — personal on user_profile, workspace on the workspace row — which is
// why Sjoerd expected to find it here and did not (2026-09-23).

import { useRouter } from 'next/navigation';
import type { Locale } from '@thefibre/shared';
import { paymentsStrings } from '@thefibre/shared/payments-i18n';
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
      s={paymentsStrings(locale)}
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
