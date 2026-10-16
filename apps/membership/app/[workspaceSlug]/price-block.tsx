'use client';

// THE price on a join-page card — tiers and products alike, one component so
// the two can never lay it out differently (Sjoerd, 2026-10-17: the small text
// goes BELOW the price, not beside it):
//
//   € 2.000                      ← the amount, alone on its line
//   per year · excl. VAT         ← unit and VAT basis, small
//   € 2.420 incl. 21% VAT        ← the other basis (children), small
//
// The callers decide the amount and pass the follow-up lines; this only
// arranges them.

import type { ReactNode } from 'react';
import { money } from '@/lib/money';
import { t, type Locale } from '@/lib/i18n';

/** The one grid every join-page card sits in (tiers and products): the same
 *  columns whatever the number of cards, left-aligned. */
export const JOIN_GRID = 'sm:grid-cols-2 xl:grid-cols-3';

export function PriceBlock({
  cents,
  currency,
  unit,
  vat,
  locale,
  children,
}: {
  cents: number;
  currency: string;
  unit: 'year' | 'month' | 'once';
  /** none = the community adds no VAT; else what `cents` is. */
  vat: 'none' | 'excl' | 'incl';
  locale: Locale;
  children?: ReactNode;
}) {
  const unitLabel = t(locale, unit === 'year' ? 'unit_per_year' : unit === 'month' ? 'unit_per_month' : 'one_off');
  const vatLabel = vat === 'none' ? null : t(locale, vat === 'incl' ? 'vat_incl_short' : 'vat_excl_short');
  return (
    <div className="mt-2">
      <div className="text-2xl font-semibold tabular-nums">{money(cents, currency)}</div>
      <div className="text-sm text-ink-subtle">{vatLabel ? `${unitLabel} · ${vatLabel}` : unitLabel}</div>
      {children}
    </div>
  );
}
