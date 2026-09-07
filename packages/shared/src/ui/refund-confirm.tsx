'use client';

// THE reimbursement confirm — one dialog, one wording, one destructive
// button, wherever a refund is offered (v0.59.0).
//
// It was born inside ui/invoices.tsx. Meet's booking detail needed the same
// thing, and the house rule is that the second caller extracts rather than
// forks: "New recurring surfaces are BORN in @thefibre/shared."
//
// Note what this component does NOT do: it never touches Stripe. Every
// refund in the family goes through POST /api/v1/purchases/:id/refund — the
// ledger is the record, Stripe is only rails. Callers pass an onConfirm that
// reaches that endpoint and nothing else.

import { chromeT } from './i18n-ui.js';
import { INTL_LOCALES, type Locale } from '../i18n.js';

export type RefundTarget = {
  payer_name: string;
  payer_email: string | null;
  amount_cents: number;
  currency: string;
  method: 'stripe' | 'invoice' | 'free';
};

export function RefundConfirm({
  target,
  busy = false,
  locale,
  onCancel,
  onConfirm,
}: {
  target: RefundTarget;
  busy?: boolean;
  locale: Locale;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const amount = new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: 'currency',
    currency: target.currency || 'EUR',
  }).format(target.amount_cents / 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={() => !busy && onCancel()} />
      <div className="relative w-full max-w-sm rounded-xl bg-surface-raised border border-line shadow-xl p-5">
        <h2 className="text-base font-semibold text-ink">{chromeT(locale, 'refund_title')}</h2>
        <p className="mt-2 text-sm text-ink-subtle">
          {chromeT(
            locale,
            // An invoice-method refund moves no money by itself — the copy
            // has to say so, or a host thinks the platform paid it back.
            target.method === 'stripe' ? 'refund_body_stripe' : 'refund_body_offline',
            { name: target.payer_name || target.payer_email || '', amount },
          )}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-ink-subtle hover:text-ink hover:bg-surface-sunken disabled:opacity-50"
          >
            {chromeT(locale, 'cancel')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? chromeT(locale, 'working') : chromeT(locale, 'reimburse')}
          </button>
        </div>
      </div>
    </div>
  );
}
