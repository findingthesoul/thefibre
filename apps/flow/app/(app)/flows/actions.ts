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
  patch: { lifecycle?: string; name?: string; description?: string | null },
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
