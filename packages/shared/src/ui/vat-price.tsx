// VAT on top of an excl.-VAT price, shown the same way on every public price
// (Sjoerd, 2026-10-16: "in the purchasing popup (and maybe in the overview)
// also show (small) the price incl. VAT if applicable" — "Like in the
// product").
//
// Two pieces, one look:
//   · VatInclNote   — the small muted line under a price: "€363 incl. 21% VAT".
//                     Before the buyer's country is known the rate is the
//                     seller's HOME rate; nothing at all when no VAT applies.
//   · VatBreakdown  — once a country (or a VAT number) is known: excl. / VAT
//                     (or reverse-charged, or outside the EU) / total.
//
// The RATE always comes from the API (lib/sale-vat.ts, the rule the checkout
// charges by) — these components only multiply, with the same rounding as
// saleVatFrom, so what is shown and what is charged cannot disagree. Never
// type a rate into a page.

import { makeT, type I18nEntry, type Locale } from '../i18n.js';
import { money } from '../money.js';

const CATALOG = {
  incl_vat_note: {
    en: '{price} incl. {pct}% VAT',
    nl: '{price} incl. {pct}% btw', // MT pending native review
    es: '{price} con {pct}% de IVA', // MT
    pt: '{price} com {pct}% de IVA', // MT
    de: '{price} inkl. {pct}% MwSt.', // MT
    fr: '{price} TTC ({pct}% de TVA)', // MT
  },
  excl_vat: {
    en: 'Excl. VAT',
    nl: 'Excl. btw', // MT pending native review
    es: 'Sin IVA', // MT
    pt: 'Sem IVA', // MT
    de: 'Ohne MwSt.', // MT
    fr: 'HT', // MT
  },
  vat: {
    en: 'VAT',
    nl: 'Btw', // MT pending native review
    es: 'IVA', // MT
    pt: 'IVA', // MT
    de: 'MwSt.', // MT
    fr: 'TVA', // MT
  },
  vat_reverse_charged: {
    en: 'VAT reverse-charged',
    nl: 'Btw verlegd', // MT pending native review
    es: 'IVA con inversión del sujeto pasivo', // MT
    pt: 'IVA autoliquidado', // MT
    de: 'MwSt. Reverse-Charge', // MT
    fr: 'TVA autoliquidée', // MT
  },
  vat_out_of_scope: {
    en: 'No VAT (outside the EU)',
    nl: 'Geen btw (buiten de EU)', // MT pending native review
    es: 'Sin IVA (fuera de la UE)', // MT
    pt: 'Sem IVA (fora da UE)', // MT
    de: 'Keine MwSt. (außerhalb der EU)', // MT
    fr: 'Pas de TVA (hors UE)', // MT
  },
  total_incl_vat: {
    en: 'Total incl. VAT',
    nl: 'Totaal incl. btw', // MT pending native review
    es: 'Total con IVA', // MT
    pt: 'Total com IVA', // MT
    de: 'Gesamt inkl. MwSt.', // MT
    fr: 'Total TTC', // MT
  },
} satisfies Record<string, I18nEntry>;

export const vatT = makeT(CATALOG);

/** The VAT on a net amount at a rate — saleVatFrom's rounding. */
export function vatOn(netCents: number, ratePct: number): number {
  return Math.round((netCents * ratePct) / 100);
}

/** "€363 incl. 21% VAT", small and muted; nothing when no VAT applies. */
export function VatInclNote({
  netCents,
  ratePct,
  currency = 'EUR',
  locale,
  className = '',
}: {
  netCents: number;
  ratePct: number | null | undefined;
  currency?: string;
  locale?: Locale | string | null;
  className?: string;
}) {
  if (!ratePct || ratePct <= 0 || netCents <= 0) return null;
  const pct = Number.isInteger(ratePct) ? String(ratePct) : String(ratePct).replace('.', locale === 'en' ? '.' : ',');
  return (
    <p className={`text-xs tabular-nums text-ink-subtle ${className}`}>
      {vatT(locale, 'incl_vat_note', { price: money(netCents + vatOn(netCents, ratePct), currency), pct })}
    </p>
  );
}

export type VatQuote = { rate_pct: number; reverse_charge: boolean };

/** Excl. / VAT / total, once the buyer's country (or VAT number) is known.
 *  A reverse charge and a sale outside the EU say so on the VAT line. */
export function VatBreakdown({
  netCents,
  quote,
  currency = 'EUR',
  locale,
  className = '',
}: {
  netCents: number;
  quote: VatQuote;
  currency?: string;
  locale?: Locale | string | null;
  className?: string;
}) {
  const tax = vatOn(netCents, quote.rate_pct);
  const vatLabel = quote.reverse_charge
    ? vatT(locale, 'vat_reverse_charged')
    : quote.rate_pct > 0
      ? `${vatT(locale, 'vat')} ${quote.rate_pct}%`
      : vatT(locale, 'vat_out_of_scope');
  return (
    <div className={`text-xs tabular-nums text-ink-subtle ${className}`}>
      <div className="flex justify-between gap-3">
        <span>{vatT(locale, 'excl_vat')}</span>
        <span>{money(netCents, currency)}</span>
      </div>
      <div className="mt-0.5 flex justify-between gap-3">
        <span>{vatLabel}</span>
        <span>{money(tax, currency)}</span>
      </div>
      <div className="mt-1 flex justify-between gap-3 border-t border-line pt-1 font-medium text-ink">
        <span>{vatT(locale, 'total_incl_vat')}</span>
        <span>{money(netCents + tax, currency)}</span>
      </div>
    </div>
  );
}
