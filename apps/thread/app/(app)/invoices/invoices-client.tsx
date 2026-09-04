'use client';

// Thin wrapper over THE canonical Invoices area
// (@thefibre/shared/ui/invoices, build-plan 1g): the app contributes only
// its server actions (they bake in its session + X-App-ID) and which
// app's chip is home. Everything visible lives in the shared component.

import { InvoicesArea } from '@thefibre/shared/ui/invoices';
import {
  listPurchases,
  resendInvoice,
  refundPurchase,
  markPurchasePaid,
  emailInvoice,
  sendPaymentLink,
} from './actions';

export function InvoicesClient({
  teams,
  defaultApp,
}: {
  teams: { id: string; name: string }[];
  defaultApp?: string;
}) {
  return (
    <InvoicesArea
      teams={teams}
      defaultApp={defaultApp ?? 'all'}
      actions={{
        listPurchases,
        resendInvoice,
        refundPurchase,
        markPurchasePaid,
        emailInvoice,
        sendPaymentLink,
      }}
    />
  );
}
