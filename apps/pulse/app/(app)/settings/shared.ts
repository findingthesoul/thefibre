// Shared types + helpers for the Settings page (server page + client cards).

export type PulseSettings = {
  currency: string;
  default_granularity: 'week' | 'fortnight' | 'month' | string;
  period_anchor_date: string | null;
  fiscal_year_start_month: number;
  horizon_months: number;
  // First cashflow column lands on this weekday (ISO 1=Mon…7=Sun); null =
  // today. Sjoerd 2026-07-09: the focus-date setting.
  focus_weekday?: number | null;
  // P4 opt-in (Sjoerd 2026-07-08: "add invoices to the sales pipeline...
  // based on payment moments of Stripe settings"): open purchase-ledger rows
  // project as receivables, settling ledger_terms_days after creation.
  include_ledger?: boolean;
  ledger_terms_days?: number;
  // Invoicing (proposal §2.8): the VAT tariff list the opportunity popup
  // offers, the workspace number sequence and the auto-send switch.
  vat_tariffs?: VatTariff[] | null;
  invoice_prefix?: string | null;
  invoice_next_number?: number | null;
  invoice_auto_send?: boolean | null;
  // History: store a projection overview every N days (null/absent = off).
  // Overviews are kept two years max (the API prunes on capture).
  snapshot_cadence_days?: number | null;
} | null;

export type VatTariff = { label: string; pct: number };

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

// Mirrors GET /api/v1/pulse/stages. The default sales flow is is_system —
// undeletable; custom stages can be added around it. `kind` carries the
// projection semantics (open = weighted by probability · committed = counts
// in full · won = done · lost = excluded).
export type Stage = {
  id: string;
  key: string;
  label: string;
  kind: 'open' | 'committed' | 'won' | 'lost' | string;
  sort_order: number;
  is_system: boolean;
  // Rows entering this stage take this probability (committed/won force 100
  // regardless). null = no default — a row keeps whatever it had.
  default_probability?: number | null;
};

export type Offering = {
  id: string;
  name: string;
  category: string | null;
  default_amount_cents: number | null;
  notes: string | null;
};

// ---------------------------------------------------------------------------
// History — stored projection overviews (pulse_projection_snapshot).
// GET /api/v1/pulse/snapshots lists metadata; ?id= returns one with payload.
// ---------------------------------------------------------------------------
export type SnapshotMeta = {
  id: string;
  taken_at: string;
  granularity: string;
};

// One period from a stored overview — the slice the compact read-only popup
// shows (start / committed in / out / end position).
export type SnapshotPeriod = {
  start: string;
  end: string;
  committed_in: number;
  committed_out: number;
  expected_in: number;
  expected_out: number;
  balance_expected: number;
};

export type SnapshotDetail = SnapshotMeta & {
  payload: {
    granularity: string;
    anchor: { bank_cents: number; reserve_cents: number };
    reservation_pct: number;
    periods: SnapshotPeriod[];
  } | null;
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
