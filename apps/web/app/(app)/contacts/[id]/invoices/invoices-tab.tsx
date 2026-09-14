'use client';

// A contact's Invoices tab: THE shared invoices area, narrowed to one person.
// Nothing visible lives here — the list, search, totals, the detail dialog
// and Resend are the shared component's, exactly as on Thread's, Meet's and
// Membership's Invoices pages. This file contributes the server actions and
// the person.

import { InvoicesArea } from '@thefibre/shared/ui/invoices';
import {
  listPurchases,
  resendInvoice,
  refundPurchase,
  markPurchasePaid,
  emailInvoice,
  sendPaymentLink,
} from './actions';

export function ContactInvoicesTab({ personId }: { personId: string }) {
  return (
    <InvoicesArea
      teams={[]}
      personId={personId}
      // An admin sees every invoice with this person; anyone else falls back
      // to their own sales automatically — the shared component already does
      // that when the workspace scope is refused.
      defaultScope="workspace"
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
