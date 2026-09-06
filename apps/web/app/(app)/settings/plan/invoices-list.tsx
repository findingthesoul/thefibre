'use client';

// The workspace's Fibre invoices, opening in the SHARED invoice dialog —
// the one viewer for the whole family (@thefibre/shared/ui/invoice-dialog).

import { useState } from 'react';
import { ENTITY } from '@thefibre/shared';
import {
  InvoiceDialog,
  type InvoicePurchase,
} from '@thefibre/shared/ui/invoice-dialog';
import { eur } from '@/lib/plans';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { emailInvoice } from './actions';

export function InvoicesList({
  invoices,
  locale,
}: {
  invoices: InvoicePurchase[];
  locale: Locale;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = invoices.find((i) => i.id === openId) ?? null;

  return (
    <>
      <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface-raised">
        {invoices.map((inv) => (
          <li key={inv.id}>
            <button
              type="button"
              onClick={() => setOpenId(inv.id)}
              className="flex w-full items-baseline justify-between gap-4 px-4 py-3 text-left text-sm hover:bg-surface-sunken/60 transition-colors"
            >
              <span className="min-w-0">
                <span className="truncate">{inv.item_label}</span>
                <span className="ml-2 text-xs text-ink-muted">
                  {inv.paid_at
                    ? new Date(inv.paid_at).toLocaleDateString(INTL_LOCALES[locale], {
                        dateStyle: 'medium',
                      })
                    : inv.status}
                </span>
              </span>
              <span className="flex shrink-0 items-baseline gap-3">
                <span className="font-mono">{eur(inv.amount_cents)}</span>
                <span className="text-xs text-ink-muted">{t(locale, 'view')} →</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <InvoiceDialog
          purchase={open}
          seller={{ legal_name: ENTITY.name, address: ENTITY.address }}
          open
          onClose={() => setOpenId(null)}
          printHref={`/settings/plan/invoices/${open.id}`}
          pdfHref={`/settings/plan/invoices/${open.id}/pdf`}
          onEmail={async (to) => {
            const r = await emailInvoice(open.id, to);
            return r.error ?? null;
          }}
        />
      )}
    </>
  );
}
