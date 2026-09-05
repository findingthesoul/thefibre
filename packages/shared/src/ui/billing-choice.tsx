'use client';

// The Invoice-or-Comped choice on manual adds (Sjoerd 2026-09-05: "adding
// people manually to a course that is actually paid should be an ask to
// send an invoice"). Born in Membership's Add-member (v0.40.0), second use
// in Thread's Add-participant (v0.43.0) — extracted at second use, the
// components-first rule. The apps own the semantics (amounts, sub-options,
// what happens on submit); this owns the look: one bordered box, two
// radios, descriptions under each.

import type { ReactNode } from 'react';

export type BillingValue = 'invoice' | 'comped';

export function BillingChoice({
  value,
  onChange,
  name = 'billing',
  invoiceLabel = 'Invoice',
  invoiceDescription,
  invoiceDisabled = false,
  compedLabel = 'Comped',
  compedDescription = 'Free — no invoice.',
  children,
}: {
  value: BillingValue;
  onChange: (v: BillingValue) => void;
  /** Radio-group name — override when two choices render in one form. */
  name?: string;
  invoiceLabel?: ReactNode;
  invoiceDescription?: ReactNode;
  /** Unpriced item: Invoice shows greyed with its description explaining why. */
  invoiceDisabled?: boolean;
  compedLabel?: ReactNode;
  compedDescription?: ReactNode;
  /** Sub-options rendered under Invoice while it is selected — e.g.
   *  Membership's yearly/monthly interval row. */
  children?: ReactNode;
}) {
  const invoiceSelected = !invoiceDisabled && value === 'invoice';
  return (
    <div>
      <label className="block text-sm font-medium mb-1">Billing</label>
      <div className="space-y-1.5 rounded-md border border-line bg-surface-sunken p-3">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name={name}
            className="mt-0.5"
            checked={invoiceSelected}
            disabled={invoiceDisabled}
            onChange={() => onChange('invoice')}
          />
          <span>
            <span className="font-medium">{invoiceLabel}</span>
            {invoiceDescription && (
              <span className="block text-xs text-ink-muted">{invoiceDescription}</span>
            )}
          </span>
        </label>
        {invoiceSelected && children}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name={name}
            className="mt-0.5"
            checked={invoiceDisabled || value === 'comped'}
            onChange={() => onChange('comped')}
          />
          <span>
            <span className="font-medium">{compedLabel}</span>
            {compedDescription && (
              <span className="block text-xs text-ink-muted">{compedDescription}</span>
            )}
          </span>
        </label>
      </div>
    </div>
  );
}
