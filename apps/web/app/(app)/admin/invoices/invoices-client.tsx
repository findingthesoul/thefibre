'use client';

// Thin wrapper over THE canonical Invoices area, the same one Meet, Thread,
// Members and the contact/organisation tabs render. This page contributes
// only what is app-bound: its server action, the single scope its list has,
// and the one seller every row shares.

import { InvoicesArea } from '@thefibre/shared/ui/invoices';
import { listPurchases } from './actions';

export function PlatformInvoicesClient({
  seller,
}: {
  seller: { legal_name: string; address?: string; tax_no?: string } | null;
}) {
  return (
    <InvoicesArea
      teams={[]}
      // One list, every workspace. With a single scope the chip row does not
      // render at all, rather than offering Me and Team against a list that
      // has no such thing.
      scopeOptions={['workspace']}
      defaultScope="workspace"
      // Every row is a Fibre subscription, so the app chips would be one
      // chip reading "All apps". The label names what this list is.
      appOptions={[{ key: 'fibre-platform', label: 'The Fibre' }]}
      defaultApp="fibre-platform"
      {...(seller
        ? {
            seller: {
              legal_name: seller.legal_name,
              ...(seller.address ? { address: seller.address } : {}),
              ...(seller.tax_no ? { tax_no: seller.tax_no } : {}),
            },
          }
        : {})}
      // listPurchases only. Mark paid, Send payment link, Reimburse and
      // Resend are omitted deliberately — see actions.ts — and the area hides
      // each button whose action is absent instead of showing a dead one.
      actions={{ listPurchases }}
    />
  );
}
