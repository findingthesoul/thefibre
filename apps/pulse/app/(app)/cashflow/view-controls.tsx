'use client';

// Shared pieces of the cashflow controls row (Sjoerd 2026-07-09 layout pass:
// "Filter rows…" is gone; the view choice is a compact select next to the
// Per-month select; the green + / red − moved here from the tab bar). Both
// views render the same cluster — the period grid adds its own Show / fit /
// chevron controls after it.

import { Minus, Plus } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n-ui';

// The "Only invoiced" filter (Sjoerd: "I want to be able to see only the
// rows that have an invoice"). Applies to INCOME rows only — costs are never
// invoiced and always show; totals stay over ALL rows (the honesty note).
export type InvoiceFilter = 'all' | 'invoiced' | 'not_invoiced';

export function matchesInvoiceFilter(
  filter: InvoiceFilter,
  cm: { direction: 'in' | 'out'; invoice_no: string | null },
): boolean {
  if (filter === 'all' || cm.direction === 'out') return true;
  return filter === 'invoiced' ? cm.invoice_no != null : cm.invoice_no == null;
}

const SELECT_CLS =
  'rounded-md border border-line bg-surface-raised px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';

export function InvoiceFilterSelect({
  value,
  locale,
  onChange,
}: {
  value: InvoiceFilter;
  locale: Locale;
  onChange: (v: InvoiceFilter) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as InvoiceFilter)}
      aria-label={t(locale, 'filter_invoice_aria')}
      className={SELECT_CLS}
    >
      <option value="all">{t(locale, 'filter_all')}</option>
      <option value="invoiced">{t(locale, 'only_invoiced')}</option>
      <option value="not_invoiced">{t(locale, 'not_invoiced')}</option>
    </select>
  );
}

// Rows filter, totals don't — say so (the existing honesty-note pattern).
export function FilteredNote({ locale }: { locale: Locale }) {
  return (
    <span className="truncate text-xs text-ink-muted">{t(locale, 'filtered_note')}</span>
  );
}

// By contact / By period — compact select (was a pill toggle above the view).
export function ViewSelect({
  value,
  locale,
  onChange,
}: {
  value: 'counterparty' | 'period';
  locale: Locale;
  onChange: (v: 'counterparty' | 'period') => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as 'counterparty' | 'period')}
      aria-label={t(locale, 'view_aria')}
      className={SELECT_CLS}
    >
      <option value="counterparty">{t(locale, 'by_contact')}</option>
      <option value="period">{t(locale, 'by_period')}</option>
    </select>
  );
}

// The green + / red − quick-adds (hover titles preserved from the tab bar).
export function AddButtons({
  locale,
  onAdd,
}: {
  locale: Locale;
  onAdd: (direction: 'in' | 'out') => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onAdd('in')}
        title={t(locale, 'add_income_title')}
        aria-label={t(locale, 'add_income')}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700"
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={() => onAdd('out')}
        title={t(locale, 'add_cost')}
        aria-label={t(locale, 'add_cost')}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm transition-colors hover:bg-rose-700"
      >
        <Minus size={16} strokeWidth={2.5} />
      </button>
    </>
  );
}
