'use client';

// An organisation's Invoices tab: THE shared invoices area, narrowed to what
// the organisation paid (purchase.payer_org_id, 20260915100000). Same list,
// dialog and Resend as everywhere; this file contributes the actions and the
// organisation. The actions are the contact tab's own — one set of wrappers,
// narrowed by orgId here and personId there.

import { InvoicesArea } from '@thefibre/shared/ui/invoices';
import {
  listPurchases,
  resendInvoice,
  refundPurchase,
  markPurchasePaid,
  emailInvoice,
  sendPaymentLink,
} from '../../../contacts/[id]/invoices/actions';

export function OrganisationInvoicesTab({ orgId }: { orgId: string }) {
  return (
    <InvoicesArea
      teams={[]}
      orgId={orgId}
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
