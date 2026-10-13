'use client';

// How a buyer may pay: online (Stripe) and/or by invoice. Born in Thread
// (the thread pricing panel and the public enrol form), second use in Meet
// when pay-by-invoice reached meeting types (Sjoerd 2026-09-14: "in Suite
// you can also pay per invoice"). Extracted at second use, the
// components-first rule.
//
// The apps own the semantics and the words: persistence, what a null list
// inherits from, the labels in their own catalogues. These own the look.

import { useState, type ReactNode } from 'react';
import { COUNTRIES } from '../countries.js';
import { SearchSelect } from './search-select.js';
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

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

/** Buyer side: what an invoice needs. Uncontrolled inputs named
 *  billing_company … billing_tax_no; read them with `readBillingFields`. */
export function InvoiceBillingFields({
  labels,
  whoPays,
  defaultCountry = '',
  inputClassName = `mt-1 ${FIELD_INPUT_CLASS}`,
  labelClassName = 'text-xs text-ink-subtle',
}: {
  /** An ISO code the form already knows — the membership panel asks for a
   *  country to price by, and asking for it twice on one form is the kind of
   *  thing people notice. Empty means ask. */
  defaultCountry?: string;
  /** "Who pays? Myself / An organisation" (docs/people-in-two-capacities-
   *  proposal.md §B). Given, the company and tax number are asked only for an
   *  organisation, and the answer rides along as billing_payer. Omitted, the
   *  form is as it always was. */
  whoPays?: { label: ReactNode; myself: ReactNode; organisation: ReactNode };
  labels: {
    company: ReactNode;
    address: ReactNode;
    postalCode: ReactNode;
    city: ReactNode;
    country: ReactNode;
    taxNo: ReactNode;
    /** Shown inside the empty picker — "Pick your country…". Optional so an
     *  older caller still compiles; the picker then shows nothing, which
     *  reads as "choose" well enough. */
    countryPlaceholder?: string;
  };
  /** Thread's public pages pass their own class so embed CSS (te-input)
   *  keeps reaching the fields. */
  inputClassName?: string;
  /** Match the labels of the form the fields sit in. */
  labelClassName?: string;
}) {
  const field = (key: string, label: ReactNode, autoComplete: string) => (
    <label className="block">
      <span className={labelClassName}>{label}</span>
      <input name={`billing_${key}`} className={inputClassName} autoComplete={autoComplete} />
    </label>
  );
  const [payer, setPayer] = useState<'self' | 'organisation'>('self');
  // Pre-filled from what the form already knows, so nobody picks a country
  // twice on one page.
  const [country, setCountry] = useState(defaultCountry);
  const forOrganisation = !whoPays || payer === 'organisation';
  return (
    <>
      {whoPays && (
        <div>
          <span className={labelClassName}>{whoPays.label}</span>
          <input type="hidden" name="billing_payer" value={payer} />
          <div className="mt-1 grid grid-cols-2 rounded-md border border-line overflow-hidden h-[34px] text-sm">
            {(['self', 'organisation'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPayer(p)}
                aria-pressed={payer === p}
                className={
                  payer === p
                    ? 'bg-surface-sunken text-ink font-medium'
                    : 'bg-surface text-ink-subtle hover:text-ink hover:bg-surface-sunken'
                }
              >
                {p === 'self' ? whoPays.myself : whoPays.organisation}
              </button>
            ))}
          </div>
        </div>
      )}
      {forOrganisation && field('company', labels.company, 'organization')}
      {field('address', labels.address, 'street-address')}
      <div className="grid grid-cols-2 gap-3">
        {field('postal_code', labels.postalCode, 'postal-code')}
        {field('city', labels.city, 'address-level2')}
      </div>
      {/* A PICKER, NOT A TEXT BOX — and this is why.
          The label says "Country" and the autocomplete hint said
          `country-name`, so people typed a NAME. Stripe wants a two-letter
          code, and anything it cannot read is dropped: a Dutch joiner typing
          "Nederland" simply lost the country from their invoice, silently,
          and the resolver added on 2026-10-13 only rescued the English
          spellings it knows. A free-text field asking for a value that must
          come from a fixed list is the bug; resolving the text afterwards was
          treating the symptom.

          It posts the ISO code directly, so nothing has to be interpreted.
          The name resolver stays in lib/billing-fields.ts for rows already
          written and for API callers that are not this form. */}
      <label className="block">
        <span className={labelClassName}>{labels.country}</span>
        <div className="mt-1">
          <SearchSelect
            name="billing_country"
            value={country}
            onChange={setCountry}
            options={COUNTRY_OPTIONS}
            placeholder={labels.countryPlaceholder ?? ''}
            className="w-full text-left"
          />
        </div>
      </label>
      {forOrganisation && field('tax_no', labels.taxNo, 'off')}
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
  /** Who pays — present only when the form asked (whoPays). */
  payer?: 'self' | 'organisation';
};

/** The billing object the Thread and Meet APIs accept, from a FormData. */
export function readBillingFields(fd: FormData): InvoiceBilling {
  const out: InvoiceBilling = {};
  for (const k of ['company', 'address', 'postal_code', 'city', 'country', 'tax_no'] as const) {
    const v = String(fd.get(`billing_${k}`) ?? '').trim();
    if (v) out[k] = v;
  }
  const payer = String(fd.get('billing_payer') ?? '');
  if (payer === 'self' || payer === 'organisation') out.payer = payer;
  return out;
}
