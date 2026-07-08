'use server';

// Settings-page server actions — the same shape as Flow's flows/actions.ts:
// apiFetch + revalidatePath, ActionResult, formatApiError. Dialogs must call
// router.refresh() after a successful save (revalidatePath alone does not
// refresh the client route).

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

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
}): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/pulse/settings', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    revalidatePath('/settings');
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
}): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/pulse/reservation-rules', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath('/settings');
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
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function deleteReservationRule(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/reservation-rules/${id}`, { method: 'DELETE' });
    revalidatePath('/settings');
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
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function removeInvolvedTeam(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/involved-teams/${id}`, { method: 'DELETE' });
    revalidatePath('/settings');
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
  revalidatePath('/settings');
  revalidatePath('/pipeline');
}

export async function createStage(input: {
  label: string;
  kind: StageKind;
  sort_order?: number;
}): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/pulse/stages', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidateStages();
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function updateStage(
  id: string,
  patch: { label?: string; kind?: StageKind; sort_order?: number },
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

// The API answers 409 with a human sentence (system stage / stage in use) —
// surface that verbatim instead of the "API 409: …" wrapper.
export async function deleteStage(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/stages/${id}`, { method: 'DELETE' });
    revalidateStages();
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      const body = e.body as { error?: unknown } | undefined;
      if (typeof body?.error === 'string') return { error: body.error };
    }
    return { error: formatApiError(e) };
  }
}

// Reorder = swap the two rows' sort_order values.
export async function swapStageOrder(
  a: { id: string; sort_order: number },
  b: { id: string; sort_order: number },
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/stages/${a.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ sort_order: b.sort_order }),
    });
    await apiFetch(`/api/v1/pulse/stages/${b.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ sort_order: a.sort_order }),
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
    revalidatePath('/settings');
    return { ok: true };
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
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}
