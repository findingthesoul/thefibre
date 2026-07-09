// Shared shapes for the pipeline surface. The Commitment shape mirrors the
// API's COMMITMENT_SELECT (apps/api/src/routes/pulse.ts) — raw FK ids are
// included so the edit dialog can preselect pickers.

export type Line = {
  id: string;
  expected_date: string;
  amount_cents: number;
  invoice_ref: string | null;
  invoiced_at: string | null;
  purchase_id?: string | null;
  settled_at: string | null;
};

// Offering rows on a commitment (pulse_commitment_item). When items exist
// they ARE the deal — the commitment's single quantity/unit_amount_cents
// stay as a legacy fallback (and get bridged to the items total on save so
// older surfaces keep showing the right number). PG numeric can arrive as a
// string via PostgREST — always Number() the quantity.
export type CommitmentItem = {
  id: string;
  offering_id: string | null;
  name: string;
  quantity: number | string;
  unit_amount_cents: number;
  repeat_cadence: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly' | null;
  sort_order: number;
};

// A VAT tariff from pulse_settings.vat_tariffs (jsonb [{label, pct}]).
export type VatTariff = { label: string; pct: number };

// Mirrors the migration default — the picker fallback when the settings
// endpoint is admin-only and the caller can't read the workspace list.
export const DEFAULT_VAT_TARIFFS: VatTariff[] = [
  { label: 'Hoog 21%', pct: 21 },
  { label: 'Laag 9%', pct: 9 },
  { label: 'Vrijgesteld 0%', pct: 0 },
];

export type Commitment = {
  id: string;
  direction: 'in' | 'out';
  label: string;
  stage: string;
  probability: number;
  quantity: number;
  unit_amount_cents: number | null;
  // Recurring is a CHARACTERISTIC of an income/cost, not a separate thing
  // (Sjoerd 2026-07-08). A cadence makes the projection expand quantity ×
  // unit_amount_cents per occurrence and ignore the commitment's lines.
  repeat_cadence: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly' | null;
  repeat_starts_on: string | null;
  repeat_until: string | null;
  // VAT tariff applied on top of the net total (numeric — may arrive as a
  // string from PostgREST). null = no VAT.
  vat_pct: number | string | null;
  // Transfer-to-invoice stamp (POST /commitments/:id/invoice). A non-null
  // invoice_no means the opportunity has been invoiced — immutable after.
  invoice_no: string | null;
  invoice_issued_at: string | null;
  purchase_id?: string | null;
  notes: string | null;
  // Optional offer/quotation URL (spec item 12) — optional in the type until
  // pulse_commitment.quote_url lands in COMMITMENT_SELECT everywhere.
  quote_url?: string | null;
  person_id: string | null;
  organisation_id: string | null;
  team_id: string | null;
  project_id: string | null;
  offering_id: string | null;
  owner_user_id: string | null;
  person: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
  organisation: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  offering: { id: string; name: string } | null;
  lines: Line[];
  items: CommitmentItem[];
};

export type OrgOption = { id: string; name: string };

export type PersonOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

// team embeds can come back as object OR single-element array from PostgREST.
export type InvolvedTeam = {
  id: string;
  team_id: string;
  team: { id: string; name: string } | { id: string; name: string }[] | null;
};

export type ProjectOption = { id: string; name: string; team_id: string | null };

export type OfferingOption = { id: string; name: string; default_amount_cents?: number | null };

// Mirrors GET /api/v1/teams (the platform SPoT endpoint) — used as the
// fallback team picker when no involved teams are configured yet.
export type TeamOption = {
  id: string;
  name: string;
  slug: string;
  member_count: number;
  is_active: boolean;
};

// What the by-period board needs from pulse_settings. Non-admins can't read
// the settings endpoint — the page falls back to fortnights anchored today.
export type PeriodSettings = {
  granularity: 'week' | 'fortnight' | 'month' | 'quarter';
  anchor_date: string | null; // null = anchor on today
};

export type MemberOption = { user_id: string; full_name: string | null; email: string | null };

// Mirrors pulse_budget_line (GET /api/v1/pulse/budget-lines). Recurring
// rules, not payments — the grid expands them into dated occurrences
// client-side, exactly like the API's projection does.
export type BudgetLine = {
  id: string;
  label: string;
  category: string | null;
  direction: 'in' | 'out';
  amount_cents: number;
  cadence: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';
  starts_on: string | null;
  ends_on: string | null;
  included: boolean;
  // Scope fields — the Me/Team/Workspace switcher filters on these
  // server-side (page.tsx). null team_id = workspace-wide overhead.
  team_id?: string | null;
  owner_user_id?: string | null;
};

// The cashflow scope (Sjoerd 2026-07-08: "cashflow per team... or per person
// or per workspace, and workspace only visible to the ones who have access").
export type CashflowScope = 'me' | 'team' | 'workspace';

// Mirrors GET /api/v1/pulse/accounts (admin-only — degrades to []). The
// grid's FINANCIAL POSITION section expands into one row per account with an
// inline-editable balance in the current-period column.
export type PulseAccount = {
  id: string;
  name: string;
  kind: 'bank' | 'reserve';
  latest_snapshot: { balance_cents: number; as_of_date: string } | null;
};

// The slice of GET /api/v1/pulse/projection the grid consumes. Only the
// "expected" layer is surfaced (his sheet's realistic row).
export type ProjectionPeriod = {
  start: string;
  end: string;
  expected_in: number;
  expected_out: number;
  reserved_expected: number;
  balance_expected: number;
};

export type Projection = {
  granularity: string;
  currency: string;
  anchor: { bank_cents: number; reserve_cents: number };
  reservation_pct: number;
  // percentage can arrive as a string (PG numeric); target_account_id feeds
  // the Bank section's projected reserve balances.
  reservation_rules?: {
    id: string;
    label: string;
    percentage: number | string;
    target_account_id?: string | null;
  }[];
  periods: ProjectionPeriod[];
};

// Mirrors GET /api/v1/pulse/stages — the pipeline flow. `kind` carries the
// projection semantics (open = weighted, committed = full, won = done,
// lost = excluded); keys are workspace-stable, labels/order are free.
export type StageOption = {
  id: string;
  key: string;
  label: string;
  kind: 'open' | 'committed' | 'won' | 'lost' | string;
  sort_order: number;
  is_system: boolean;
  // Rows entering this stage take this probability (unless the kind forces
  // 100). null = no default — the row keeps whatever it had.
  default_probability?: number | null;
};

// Degradation path: if the stages fetch fails, the dialog still works with
// the default sales flow Pulse seeds on activation.
export const FALLBACK_STAGES: StageOption[] = [
  { id: 'lead', key: 'lead', label: 'Lead', kind: 'open', sort_order: 1, is_system: true },
  { id: 'proposal', key: 'proposal', label: 'Proposal', kind: 'open', sort_order: 2, is_system: true },
  { id: 'committed', key: 'committed', label: 'Committed', kind: 'committed', sort_order: 3, is_system: true },
  { id: 'done', key: 'done', label: 'Done', kind: 'won', sort_order: 4, is_system: true },
  { id: 'cancelled', key: 'cancelled', label: 'Cancelled', kind: 'lost', sort_order: 5, is_system: true },
];

export type Pickers = {
  orgs: OrgOption[];
  persons: PersonOption[];
  teams: InvolvedTeam[];
  // ALL active workspace teams — the dialog falls back to these when no
  // involved teams are marked in Settings (the select must never be empty).
  allTeams: TeamOption[];
  projects: ProjectOption[];
  offerings: OfferingOption[];
  members: MemberOption[];
  stages: StageOption[];
  // Workspace VAT tariffs (Settings → Invoicing). Falls back to the seeded
  // defaults when the settings read is admin-only.
  vatTariffs: VatTariff[];
};

export function teamName(t: InvolvedTeam['team']): string {
  const one = Array.isArray(t) ? t[0] : t;
  return one?.name ?? 'Unnamed team';
}

export function personName(p: PersonOption): string {
  const full = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
  return full || p.email || 'Unnamed';
}

// ---------------------------------------------------------------------------
// Group-fold persistence (Sjoerd 2026-07-09: "store pref of the latest
// visit"): client groups default CLOSED; the set of open group keys is
// remembered per view in localStorage and restored on mount.
// ---------------------------------------------------------------------------
const FOLDS_KEY = 'thefibre.pulse.cashflow-folds';

export function loadOpenGroups(view: 'counterparty' | 'period'): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const all = JSON.parse(window.localStorage.getItem(FOLDS_KEY) ?? '{}') as Record<
      string,
      unknown
    >;
    const keys = all[view];
    return new Set(Array.isArray(keys) ? keys.filter((k) => typeof k === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveOpenGroups(view: 'counterparty' | 'period', open: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    const all = JSON.parse(window.localStorage.getItem(FOLDS_KEY) ?? '{}') as Record<
      string,
      unknown
    >;
    all[view] = [...open];
    window.localStorage.setItem(FOLDS_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable — folds just don't persist */
  }
}

// One rule for "how big is this deal", shared by the counterparty table and
// the org popup: offering items win, then legacy quantity × unit price, then
// the sum of unsettled expected payments.
export function commitmentNetTotal(cm: Commitment): number {
  if (cm.items && cm.items.length > 0) {
    return cm.items.reduce(
      (a, i) => a + Math.round(Number(i.quantity) * i.unit_amount_cents),
      0,
    );
  }
  if (cm.unit_amount_cents != null) {
    return Math.round(Number(cm.quantity) * cm.unit_amount_cents);
  }
  return cm.lines.filter((l) => !l.settled_at).reduce((a, l) => a + l.amount_cents, 0);
}
