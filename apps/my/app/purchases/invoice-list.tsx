'use client';

// The member's invoices, each one openable.
//
// Sjoerd, 2026-10-04: a person should be able to "see his/her invoice online
// (in my.thread — thus login)". Until now this list showed a row and a PDF
// link: to read what they had actually been charged for, a member had to
// download a file. The document is now on the screen.
//
// THE SAME DIALOG the organiser sees. `InvoiceDialog` is the canonical
// viewer for the whole family, and it is read-only by default — `actions`,
// `onEmail` and the rest are optional props, so a participant build simply
// omits them and gets share, download and print with no management
// affordance anywhere near it. A portal-only copy would be a second answer
// to "what does an invoice look like", on the one document where buyer and
// seller must be looking at the same thing.
//
// THE DEEP LINK, and why it needs no ownership check of its own:
// /purchases/<id> renders this list with `openId` set, and the list is
// already nothing but the rows the signed-in member owns (the API matches
// person_id OR payer_email against their verified address). An id that is
// not theirs is simply not found here, so it opens no dialog and says
// nothing — the same screen a nonexistent id gets. The check falls out of
// the data rather than being a second rule that could disagree with the
// first one.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { InvoiceDialog } from '@thefibre/shared/ui/invoice-dialog';
import type { PortalInvoice } from '@/lib/portal-api';
import { invoicePdfUrl } from '@/lib/portal-api';
import { DEFAULT_TZ, fmtDate, money } from '@/lib/format';
import { chromeT, useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t, type MyKey } from '@/lib/i18n';

/** What the member calls the thing that sold it. The slug is ours. */
// What a row says it was when the purchase carries no label. "Thread" and
// "The Thread" are product names and stay as they are in every language.
const SOLD_BY: Record<string, MyKey | string> = {
  membership: 'sold_membership',
  'the-thread': 'Thread',
  'fibre-meet': 'sold_meeting',
  'fibre-platform': 'The Thread',
};
// The shared chrome already names these (the invoice dialog uses the same
// words); anything else is shown as the API sent it.
const STATUS: Record<string, 'status_pending' | 'status_paid' | 'status_refunded' | 'status_failed'> = {
  pending: 'status_pending',
  paid: 'status_paid',
  refunded: 'status_refunded',
  failed: 'status_failed',
};

export function InvoiceList({
  invoices,
  openId = null,
}: {
  invoices: PortalInvoice[];
  /** From /purchases/<id>. Null on the plain list. */
  openId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(openId);
  const locale = useLocale();
  const soldBy = (app: string) => {
    const v = SOLD_BY[app];
    return v === 'sold_membership' || v === 'sold_meeting' ? t(locale, v) : v;
  };
  const current = invoices.find((i) => i.id === open) ?? null;

  function close() {
    setOpen(null);
    // Put the address back to the list, so Back does not reopen the dialog
    // and a reload does not either. `replace`, not `push`: the dialog was
    // not a navigation the member made.
    if (openId) router.replace('/purchases');
  }

  return (
    <>
      <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {invoices.map((inv) => (
          <li key={inv.id} className="flex items-center gap-3 p-4">
            {/* The ROW opens the document. A button rather than a link: it
                opens a dialog in place, and a link would promise a page. */}
            <button
              type="button"
              onClick={() => setOpen(inv.id)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate text-sm text-ink underline-offset-2 hover:underline">
                {inv.item_label || soldBy(inv.app) || t(locale, 'purchase')}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                {inv.workspace && <span className="truncate">{inv.workspace}</span>}
                {inv.workspace && <span aria-hidden>·</span>}
                <span>{fmtDate(inv.created_at, locale, DEFAULT_TZ)}</span>
                {inv.status !== 'paid' && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="capitalize">{STATUS[inv.status] ? chromeT(locale, STATUS[inv.status]!) : inv.status}</span>
                  </>
                )}
              </span>
            </button>
            <span className="shrink-0 tabular-nums text-sm text-ink">
              {money(inv.amount_cents, inv.currency, locale)}
            </span>
            {/* The PDF link stays. Opening the document is the new thing, not
                a replacement: somebody who came here to file a receipt wants
                the file, and taking that away to make room for a dialog would
                be a worse list than before. A plain link cannot carry a
                bearer token, which is why it goes the long way round through
                this app's own route handler. */}
            <a
              href={invoicePdfUrl(inv.id)}
              className="inline-flex min-h-11 shrink-0 items-center text-sm text-ink underline underline-offset-2 hover:opacity-70"
            >
              PDF
            </a>
          </li>
        ))}
      </ul>

      {current && (
        <InvoiceDialog
          open
          onClose={close}
          purchase={{
            id: current.id,
            item_label: current.item_label ?? '',
            amount_cents: current.amount_cents,
            currency: current.currency,
            status: current.status,
            method: current.method ?? 'invoice',
            paid_at: current.paid_at,
            created_at: current.created_at,
            payer_name: current.payer_name ?? '',
            payer_email: current.payer_email ?? null,
            stripe_invoice_url: current.stripe_invoice_url,
            billing: (current.billing as never) ?? null,
          }}
          seller={current.seller ?? undefined}
          pdfHref={invoicePdfUrl(current.id)}
          // The share link is the deep link to this same invoice, which only
          // opens for somebody who can sign in as its owner. No token in it:
          // an invoice URL gets forwarded and quoted, and a tokenised one
          // would turn every forward into a disclosure of somebody's payment
          // history.
          shareHref={`/purchases/${current.id}`}
          // No `actions` and no `onEmail`: a participant views, and that is
          // the whole of it. Reimburse, mark paid and send-payment-link are
          // the seller's, and they are absent here because they were never
          // passed — not because they are hidden.
        />
      )}
    </>
  );
}
