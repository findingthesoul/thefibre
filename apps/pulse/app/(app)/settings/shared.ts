// Shared types + helpers for the Settings page (server page + client cards).

export type PulseSettings = {
  currency: string;
  default_granularity: 'week' | 'fortnight' | 'month' | string;
  period_anchor_date: string | null;
  fiscal_year_start_month: number;
  horizon_months: number;
} | null;

export type Rule = {
  id: string;
  label: string;
  percentage: number | string; // PG numeric arrives as string
  basis: 'revenue' | 'net_revenue' | string;
  target_account_id: string | null;
  included: boolean;
};

export type Account = {
  id: string;
  name: string;
  kind: 'bank' | 'reserve' | string;
};

export type InvolvedTeam = {
  id: string;
  team_id: string;
  // PostgREST embeds can come back as an object or a one-element array.
  team: { id: string; name: string } | { id: string; name: string }[] | null;
};

export type WorkspaceTeam = {
  id: string;
  name: string;
  slug?: string;
  member_count?: number;
  is_active?: boolean;
};

export type Offering = {
  id: string;
  name: string;
  category: string | null;
  default_amount_cents: number | null;
  notes: string | null;
};

/** Normalize a PostgREST embed that may be object, array or null. */
export function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/** Euro string ("1250,50" or "1250.50") → integer cents. Returns null for
 *  empty input, NaN for unparsable input (caller must check). */
export function parseEuroToCents(v: string): number | null {
  const t = v.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const f = parseFloat(t);
  if (Number.isNaN(f)) return NaN;
  return Math.round(f * 100);
}

/** Integer cents → euro input string ("1250.50"). */
export function centsToEuroInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2);
}

export const INPUT_CLS =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const ERROR_CLS =
  'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700';
