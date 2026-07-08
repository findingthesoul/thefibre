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

export type Commitment = {
  id: string;
  direction: 'in' | 'out';
  label: string;
  stage: string;
  probability: number;
  quantity: number;
  unit_amount_cents: number | null;
  notes: string | null;
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
  granularity: 'week' | 'fortnight' | 'month';
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
};

export function teamName(t: InvolvedTeam['team']): string {
  const one = Array.isArray(t) ? t[0] : t;
  return one?.name ?? 'Unnamed team';
}

export function personName(p: PersonOption): string {
  const full = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
  return full || p.email || 'Unnamed';
}
