'use server';

// Settings-page server actions — the same shape as Flow's flows/actions.ts:
// apiFetch + revalidatePath, ActionResult, formatApiError. Dialogs must call
// router.refresh() after a successful save (revalidatePath alone does not
// refresh the client route).

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';
import type { SnapshotDetail } from './shared';

export type ActionResult<T = unknown> = { ok?: boolean; error?: string; data?: T };

function formatApiError(e: unknown): string {
  if (!(e instanceof ApiError)) return 'unknown error';
  const body = e.body as { error?: unknown; details?: unknown; code?: string } | undefined;
  const raw = body?.error ?? body?.details ?? body?.code;
  let detail: string | undefined;
  if (typeof raw === 'string') detail = raw;
  else if (raw && typeof raw === 'object') {
    try {
      detail = JSON.stringify(raw);
    } catch {
      /* ignore */
    }
  }
  return detail ? `API ${e.status}: ${detail}` : `API ${e.status}`;
}

// ---------------------------------------------------------------------------
// Time rhythm & currency
// ---------------------------------------------------------------------------
export async function updatePulseSettings(input: {
  currency?: string;
  default_granularity?: 'week' | 'fortnight' | 'month';
  period_anchor_date?: string | null;
  fiscal_year_start_month?: number;
  horizon_months?: number;
  // First cashflow column lands on this weekday (ISO 1=Mon…7=Sun; null =
  // today) — the projection shifts its window the same way.
  focus_weekday?: number | null;
  // Ledger invoices → pipeline (P4 opt-in) + expected settlement terms.
  include_ledger?: boolean;
  ledger_terms_days?: number;
  // Invoicing: number prefix, auto-send, and the VAT tariff list the
  // opportunity popup offers ([{label, pct}]).
  invoice_prefix?: string;
  invoice_auto_send?: boolean;
  vat_tariffs?: { label: string; pct: number }[];
  // History: store a projection overview every N days (null = off). The API
  // prunes overviews older than two years.
  snapshot_cadence_days?: number | null;
}): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/pulse/settings', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    revalidatePath('/settings/planner');
    // The ledger toggle changes what the projection shows.
    revalidatePath('/cashflow');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// ---------------------------------------------------------------------------
// Reservation rules
// ---------------------------------------------------------------------------
export async function createReservationRule(input: {
  label: string;
  percentage: number;
  basis: 'revenue' | 'net_revenue';
  target_account_id?: string | null;
  // Scope, like accounts (both null = workspace) — the cashflow grid's
  // per-tab "+" creates team/personal rules; Settings creates workspace ones.
  team_id?: string | null;
  owner_user_id?: string | null;
}): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/pulse/reservation-rules', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath('/settings/planner');
    // Rules feed the projection's RESERVATIONS rows.
    revalidatePath('/cashflow');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function updateReservationRule(
  id: string,
  patch: {
    label?: string;
    percentage?: number;
    basis?: 'revenue' | 'net_revenue';
    target_account_id?: string | null;
    included?: boolean;
  },
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/reservation-rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath('/settings/planner');
    revalidatePath('/cashflow');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function deleteReservationRule(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/reservation-rules/${id}`, { method: 'DELETE' });
    revalidatePath('/settings/planner');
    revalidatePath('/cashflow');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// ---------------------------------------------------------------------------
// Involved teams
// ---------------------------------------------------------------------------
export async function addInvolvedTeam(teamId: string): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/pulse/involved-teams', {
      method: 'POST',
      body: JSON.stringify({ team_id: teamId }),
    });
    revalidatePath('/settings/planner');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function removeInvolvedTeam(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/involved-teams/${id}`, { method: 'DELETE' });
    revalidatePath('/settings/planner');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// ---------------------------------------------------------------------------
// Pipeline stages — the flow lives on /settings, the pipeline consumes it,
// so both routes get revalidated.
// ---------------------------------------------------------------------------
type StageKind = 'open' | 'committed' | 'won' | 'lost';

function revalidateStages() {
  revalidatePath('/settings/planner');
  revalidatePath('/cashflow');
}

// Stages are authored in Fibre Flow (the Pipeline flow) and mirrored here.
// The Pulse-side edits are the money-semantics overlay (`kind`) and the
// default probability rows take on entering the stage.
export async function updateStage(
  id: string,
  patch: { kind?: StageKind; default_probability?: number | null },
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/stages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidateStages();
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// ---------------------------------------------------------------------------
// Offerings
// ---------------------------------------------------------------------------
export async function createOffering(input: {
  name: string;
  category?: string | null;
  default_amount_cents?: number | null;
  notes?: string | null;
}): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/pulse/offerings', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath('/settings/planner');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// ---------------------------------------------------------------------------
// History — stored projection overviews (the comparison view's raw material).
// The detail read happens through a server action because apiFetch is
// server-only (serverSupabase); the History card calls this on row click.
// ---------------------------------------------------------------------------
export async function fetchSnapshot(id: string): Promise<ActionResult<SnapshotDetail>> {
  try {
    const r = await apiFetch<{ item: SnapshotDetail | null }>(
      `/api/v1/pulse/snapshots?id=${encodeURIComponent(id)}`,
    );
    if (!r.item) return { error: 'Overview not found.' };
    return { ok: true, data: r.item };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function updateOffering(
  id: string,
  patch: {
    name?: string;
    category?: string | null;
    default_amount_cents?: number | null;
    notes?: string | null;
    archived?: boolean;
  },
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/offerings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath('/settings/planner');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}
