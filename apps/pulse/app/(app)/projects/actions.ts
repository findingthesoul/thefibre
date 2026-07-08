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

export async function saveProject(input: {
  id: string | null;
  name: string;
  team_id: string | null;
  notes: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const { id, ...body } = input;
  try {
    const r = id
      ? await apiFetch<{ item: { id: string } }>(`/api/v1/pulse/projects/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await apiFetch<{ item: { id: string } }>('/api/v1/pulse/projects', {
          method: 'POST',
          body: JSON.stringify(body),
        });
    revalidatePath('/projects');
    return { ok: true, data: { id: r.item.id } };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// "Delete" archives — PATCH {archived:true} sets archived_at server-side.
export async function archiveProject(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ archived: true }),
    });
    revalidatePath('/projects');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}
