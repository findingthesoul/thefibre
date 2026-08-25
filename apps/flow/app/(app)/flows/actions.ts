'use server';

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

export async function createFlow(input: {
  name: string;
  description?: string | null;
  scope: 'personal' | 'team' | 'workspace';
  team_id?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const r = await apiFetch<{ id: string; draft_version_id: string }>('/api/v1/flow/flows', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath('/flows');
    return { ok: true, data: { id: r.id } };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function saveGraph(flowId: string, graphJson: string): Promise<ActionResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(graphJson);
  } catch (e) {
    return { error: `Graph is not valid JSON — ${e instanceof Error ? e.message : 'parse failed'}` };
  }
  try {
    await apiFetch(`/api/v1/flow/flows/${flowId}/graph`, {
      method: 'PUT',
      body: JSON.stringify(parsed),
    });
    revalidatePath(`/flows/${flowId}`);
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

/**
 * What an import would do, before it does it.
 *
 * Importing replaces every step of the target version, so the user gets the
 * plan first — counts, which steps disappear, whether a new version appears
 * under live runs — and decides. The API does the whole validation pass in
 * dry-run mode, so a file that fails here would have failed on apply.
 */
export type ImportPlan = {
  steps: { incoming: number; replacing: number };
  transitions: { incoming: number; replacing: number };
  step_default_tasks: { incoming: number; replacing: number };
  removed_step_keys: string[];
  added_step_keys: string[];
  target_version: { id: string | null; version_number: number; creates_new_version: boolean };
  run_count: number;
  flow: {
    progression: { from: string; to: string } | null;
    system_key: { from: string | null; to: string | null } | null;
    system_key_taken_by: string | null;
  };
};

export async function previewImport(
  flowId: string,
  designJson: string,
): Promise<ActionResult<ImportPlan>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(designJson);
  } catch (e) {
    return { error: `Not valid JSON — ${e instanceof Error ? e.message : 'parse failed'}` };
  }
  try {
    const r = await apiFetch<{ plan: ImportPlan }>(
      `/api/v1/flow/flows/${flowId}/graph?dry_run=1`,
      { method: 'PUT', body: JSON.stringify(parsed) },
    );
    return { ok: true, data: r.plan };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function importDesign(flowId: string, designJson: string): Promise<ActionResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(designJson);
  } catch (e) {
    return { error: `Not valid JSON — ${e instanceof Error ? e.message : 'parse failed'}` };
  }
  try {
    await apiFetch(`/api/v1/flow/flows/${flowId}/graph`, {
      method: 'PUT',
      body: JSON.stringify(parsed),
    });
    revalidatePath(`/flows/${flowId}`);
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

/** The flow as a design file — the same shape importDesign accepts. */
export async function exportDesign(flowId: string): Promise<ActionResult<string>> {
  try {
    const r = await apiFetch<Record<string, unknown>>(`/api/v1/flow/flows/${flowId}/graph`);
    return { ok: true, data: JSON.stringify(r, null, 2) };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function publishFlow(flowId: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/flow/flows/${flowId}/publish`, { method: 'POST' });
    revalidatePath(`/flows/${flowId}`);
    revalidatePath('/flows');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function patchFlow(
  flowId: string,
  patch: { lifecycle?: string; name?: string; description?: string | null; progression?: 'gated' | 'open' },
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/flow/flows/${flowId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath(`/flows/${flowId}`);
    revalidatePath('/flows');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function deleteFlow(flowId: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/flow/flows/${flowId}`, { method: 'DELETE' });
    revalidatePath('/flows');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// --- Phase D runtime actions ---

export async function searchPersons(
  q: string,
): Promise<ActionResult<{ id: string; first_name: string | null; last_name: string | null; email: string | null }[]>> {
  try {
    const params = new URLSearchParams({ limit: '20' });
    if (q.trim()) params.set('q', q.trim());
    const r = await apiFetch<{ items: { id: string; first_name: string | null; last_name: string | null; email: string | null }[] }>(
      `/api/v1/persons?${params.toString()}`,
    );
    return { ok: true, data: r.items };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function startRun(flowId: string, personId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const r = await apiFetch<{ id: string }>(`/api/v1/flow/flows/${flowId}/runs`, {
      method: 'POST',
      body: JSON.stringify({ person_id: personId }),
    });
    revalidatePath(`/flows/${flowId}`);
    return { ok: true, data: r };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function transitionRun(
  runId: string,
  transitionId: string,
  overrideReason?: string | null,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/flow/runs/${runId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ transition_id: transitionId, override_reason: overrideReason ?? null }),
    });
    revalidatePath(`/runs/${runId}`);
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function withdrawRun(runId: string, reason?: string | null): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/flow/runs/${runId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason ?? null }),
    });
    revalidatePath(`/runs/${runId}`);
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function completeTask(taskId: string, runId: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/flow/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'done' }),
    });
    revalidatePath(`/runs/${runId}`);
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function reopenTask(taskId: string, runId: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/flow/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'open' }),
    });
    revalidatePath(`/runs/${runId}`);
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function getRunDetail(runId: string): Promise<ActionResult<unknown>> {
  try {
    const data = await apiFetch(`/api/v1/flow/runs/${runId}`);
    return { ok: true, data };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function repositionRun(runId: string, stepKey: string, reason?: string | null): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/flow/runs/${runId}/move`, {
      method: 'POST',
      body: JSON.stringify({ step_key: stepKey, reason: reason ?? null }),
    });
    revalidatePath(`/runs/${runId}`);
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function toggleFavorite(flowId: string, favorite: boolean): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/flow/flows/${flowId}/favorite`, { method: favorite ? 'PUT' : 'DELETE' });
    revalidatePath('/flows');
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// --- Phase E: task list actions (revalidate the tasks + dashboard pages) ---

export async function createManualTask(input: {
  title: string;
  due_at?: string | null;
}): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/flow/tasks', { method: 'POST', body: JSON.stringify(input) });
    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function setTaskStatus(taskId: string, status: 'open' | 'done'): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/flow/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

export async function addRunNote(runId: string, stepKey: string, body: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/flow/runs/${runId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ step_key: stepKey, body }),
    });
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}
