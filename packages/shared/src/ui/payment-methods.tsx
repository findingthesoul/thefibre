'use client';

// How a buyer may pay: online (Stripe) and/or by invoice. Born in Thread
// (the thread pricing panel and the public enrol form), second use in Meet
// when pay-by-invoice reached meeting types (Sjoerd 2026-09-14: "in Suite
// you can also pay per invoice"). Extracted at second use, the
// components-first rule.
//
// The apps own the semantics and the words: persistence, what a null list
// inherits from, the labels in their own catalogues. These own the look.

import type { ReactNode } from 'react';
import { FIELD_INPUT_CLASS } from './fields.js';

export type PayMethod = 'stripe' | 'invoice';

const ORDER: PayMethod[] = ['stripe', 'invoice'];

/** Organiser side. `null` = inherit (the account default); a non-empty list =
 *  this item's own. Unticking the last method is refused, so an item can
 *  never end up with no way to be paid. */
export function PaymentMethodsPicker({
  value,
  onChange,
  labels,
  name = 'pm-mode',
  disabled = false,
  note,
}: {
  value: PayMethod[] | null;
  onChange: (next: PayMethod[] | null) => void;
  labels: { inherit: ReactNode; custom: ReactNode; online: ReactNode; invoice: ReactNode };
  /** Radio-group name — override when two pickers render in one form. */
  name?: string;
  disabled?: boolean;
  /** Anything beside the choices, e.g. a "Saved." note. */
  note?: ReactNode;
}) {
  const custom = value !== null;
  const on = new Set<PayMethod>(value ?? ['stripe']);
  function toggle(m: PayMethod, checked: boolean) {
    const next = ORDER.filter((x) => (x === m ? checked : on.has(x)));
    if (next.length) onChange(next);
  }
  return (
    <div className="flex flex-wrap items-center gap-4">
      <label className="inline-flex items-center gap-2 text-sm text-ink-subtle cursor-pointer">
        <input
          type="radio"
          name={name}
          checked={!custom}
          disabled={disabled}
          onChange={() => onChange(null)}
        />
        {labels.inherit}
      </label>
      <label className="inline-flex items-center gap-2 text-sm text-ink-subtle cursor-pointer">
        <input
          type="radio"
          name={name}
          checked={custom}
          disabled={disabled}
          onChange={() => onChange(ORDER.filter((x) => on.has(x)))}
        />
        {labels.custom}
      </label>
      {custom && (
        <span className="inline-flex items-center gap-4">
          {ORDER.map((m) => (
            <label
              key={m}
              className="inline-flex items-center gap-1.5 text-sm text-ink-subtle cursor-pointer"
            >
              <input
                type="checkbox"
                checked={on.has(m)}
                disabled={disabled}
                onChange={(e) => toggle(m, e.target.checked)}
              />
              {m === 'stripe' ? labels.online : labels.invoice}
            </label>
          ))}
        </span>
      )}
      {note}
    </div>
  );
}

/** Buyer side: the two-way switch, shown only when both are on offer. */
export function PayMethodSwitch({
  value,
  onChange,
  label,
  labels,
}: {
  value: PayMethod;
  onChange: (m: PayMethod) => void;
  label: ReactNode;
  labels: { online: ReactNode; invoice: ReactNode };
}) {
  return (
    <div>
      <span className="text-xs text-ink-subtle">{label}</span>
      <div className="mt-1 grid grid-cols-2 rounded-md border border-line overflow-hidden h-[34px] text-sm">
        {ORDER.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-pressed={value === m}
            className={
              value === m
                ? 'bg-surface-sunken text-ink font-medium'
                : 'bg-surface text-ink-subtle hover:text-ink hover:bg-surface-sunken'
            }
          >
            {m === 'stripe' ? labels.online : labels.invoice}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Buyer side: what an invoice needs. Uncontrolled inputs named
 *  billing_company … billing_tax_no; read them with `readBillingFields`. */
export function InvoiceBillingFields({
  labels,
  inputClassName = `mt-1 ${FIELD_INPUT_CLASS}`,
}: {
  labels: {
    company: ReactNode;
    address: ReactNode;
    postalCode: ReactNode;
    city: ReactNode;
    country: ReactNode;
    taxNo: ReactNode;
  };
  /** Thread's public pages pass their own class so embed CSS (te-input)
   *  keeps reaching the fields. */
  inputClassName?: string;
}) {
  const field = (key: string, label: ReactNode, autoComplete: string) => (
    <label className="block">
      <span className="text-xs text-ink-subtle">{label}</span>
      <input name={`billing_${key}`} className={inputClassName} autoComplete={autoComplete} />
    </label>
  );
  return (
    <>
      {field('company', labels.company, 'organization')}
      {field('address', labels.address, 'street-address')}
      <div className="grid grid-cols-2 gap-3">
        {field('postal_code', labels.postalCode, 'postal-code')}
        {field('city', labels.city, 'address-level2')}
      </div>
      {field('country', labels.country, 'country-name')}
      {field('tax_no', labels.taxNo, 'off')}
    </>
  );
}

export type InvoiceBilling = {
  company?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  tax_no?: string;
};

/** The billing object the Thread and Meet APIs accept, from a FormData. */
export function readBillingFields(fd: FormData): InvoiceBilling {
  const out: InvoiceBilling = {};
  for (const k of ['company', 'address', 'postal_code', 'city', 'country', 'tax_no'] as const) {
    const v = String(fd.get(`billing_${k}`) ?? '').trim();
    if (v) out[k] = v;
  }
  return out;
}
