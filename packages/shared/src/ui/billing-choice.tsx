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

// EVERY WORD HERE COMES FROM THE CALLER, and v1.159.0 is why.
//
// The heading was the literal string "Billing", and `invoiceLabel`,
// `compedLabel` and `compedDescription` had English defaults — 'Invoice',
// 'Comped', 'Free — no invoice.'. Membership passed neither label, so its
// Add-member dialog said "Billing / Invoice / Comped" to a Dutch, German or
// French admin while the two sentences under them were translated. Nothing
// failed: a default is the one way a six-locale product ships English without
// a missing-translation error, because there is no missing translation.
//
// So the words are REQUIRED, and the two descriptions are required-and-
// nullable: a caller with nothing to add under a radio writes `null` and has
// said so. No `ReactNode` default anywhere in this file.
export function BillingChoice({
  value,
  onChange,
  name = 'billing',
  heading,
  invoiceLabel,
  invoiceDescription,
  invoiceDisabled = false,
  compedLabel,
  compedDescription,
  children,
}: {
  value: BillingValue;
  onChange: (v: BillingValue) => void;
  /** Radio-group name — override when two choices render in one form. */
  name?: string;
  /** The box's own label, e.g. t(locale, 'billing'). */
  heading: ReactNode;
  invoiceLabel: ReactNode;
  invoiceDescription: ReactNode | null;
  /** Unpriced item: Invoice shows greyed with its description explaining why. */
  invoiceDisabled?: boolean;
  compedLabel: ReactNode;
  compedDescription: ReactNode | null;
  /** Sub-options rendered under Invoice while it is selected — e.g.
   *  Membership's yearly/monthly interval row. */
  children?: ReactNode;
}) {
  const invoiceSelected = !invoiceDisabled && value === 'invoice';
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{heading}</label>
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
