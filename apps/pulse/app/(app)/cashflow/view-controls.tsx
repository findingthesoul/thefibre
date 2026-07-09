'use client';

// Shared pieces of the cashflow controls row (Sjoerd 2026-07-09 layout pass:
// "Filter rows…" is gone; the view choice is a compact select next to the
// Per-month select; the green + / red − moved here from the tab bar). Both
// views render the same cluster — the period grid adds its own Show / fit /
// chevron controls after it.

import { Minus, Plus } from 'lucide-react';

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
  onChange,
}: {
  value: InvoiceFilter;
  onChange: (v: InvoiceFilter) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as InvoiceFilter)}
      aria-label="Filter income rows by invoice status"
      className={SELECT_CLS}
    >
      <option value="all">All</option>
      <option value="invoiced">Only invoiced</option>
      <option value="not_invoiced">Not invoiced</option>
    </select>
  );
}

// Rows filter, totals don't — say so (the existing honesty-note pattern).
export function FilteredNote() {
  return (
    <span className="truncate text-xs text-ink-muted">
      (filtered view — totals cover all rows)
    </span>
  );
}

// By contact / By period — compact select (was a pill toggle above the view).
export function ViewSelect({
  value,
  onChange,
}: {
  value: 'counterparty' | 'period';
  onChange: (v: 'counterparty' | 'period') => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as 'counterparty' | 'period')}
      aria-label="View"
      className={SELECT_CLS}
    >
      <option value="counterparty">By contact</option>
      <option value="period">By period</option>
    </select>
  );
}

// The green + / red − quick-adds (hover titles preserved from the tab bar).
export function AddButtons({ onAdd }: { onAdd: (direction: 'in' | 'out') => void }) {
  return (
    <>
      <button
        type="button"
        onClick={() => onAdd('in')}
        title="Add income — a contact and an amount is enough"
        aria-label="Add income"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-700"
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={() => onAdd('out')}
        title="Add a cost"
        aria-label="Add a cost"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm transition-colors hover:bg-rose-700"
      >
        <Minus size={16} strokeWidth={2.5} />
      </button>
    </>
  );
}
