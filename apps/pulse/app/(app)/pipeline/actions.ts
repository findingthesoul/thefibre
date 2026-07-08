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

// Matches the API's CreateCommitment zod schema. owner_user_id is optional —
// omitted means the API defaults to the caller (create) / keeps current (patch).
export type CommitmentPayload = {
  direction: 'in' | 'out';
  label: string;
  person_id: string | null;
  organisation_id: string | null;
  team_id: string | null;
  project_id: string | null;
  offering_id: string | null;
  owner_user_id?: string;
  stage: 'lead' | 'proposal' | 'committed' | 'done' | 'cancelled';
  probability: number;
  notes: string | null;
};

export type LinePayload = {
  id?: string; // present = existing line
  dirty?: boolean; // existing line whose fields changed → PATCH
  expected_date: string;
  amount_cents: number;
  invoice_ref: string | null;
  invoiced_at: string | null;
  settled_at: string | null;
};

// One action for the whole dialog save: create-or-patch the commitment, then
// diff the desired lines against the originals (delete removed, post new,
// patch changed). Single round-trip from the client.
export async function saveCommitment(input: {
  id: string | null;
  commitment: CommitmentPayload;
  lines: LinePayload[];
  originalLineIds: string[];
}): Promise<ActionResult<{ id: string }>> {
  try {
    const { id, commitment, lines, originalLineIds } = input;

    let commitmentId = id;
    if (commitmentId) {
      await apiFetch(`/api/v1/pulse/commitments/${commitmentId}`, {
        method: 'PATCH',
        body: JSON.stringify(commitment),
      });
    } else {
      const r = await apiFetch<{ item: { id: string } }>('/api/v1/pulse/commitments', {
        method: 'POST',
        body: JSON.stringify(commitment),
      });
      commitmentId = r.item.id;
    }

    // Removed rows first — original ids no longer present.
    const keptIds = new Set(lines.map((l) => l.id).filter(Boolean));
    for (const lineId of originalLineIds) {
      if (!keptIds.has(lineId)) {
        await apiFetch(`/api/v1/pulse/lines/${lineId}`, { method: 'DELETE' });
      }
    }

    for (const l of lines) {
      const body = JSON.stringify({
        expected_date: l.expected_date,
        amount_cents: l.amount_cents,
        invoice_ref: l.invoice_ref,
        invoiced_at: l.invoiced_at,
        settled_at: l.settled_at,
      });
      if (!l.id) {
        await apiFetch(`/api/v1/pulse/commitments/${commitmentId}/lines`, {
          method: 'POST',
          body,
        });
      } else if (l.dirty) {
        await apiFetch(`/api/v1/pulse/lines/${l.id}`, { method: 'PATCH', body });
      }
    }

    revalidatePath('/pipeline');
    return { ok: true, data: { id: commitmentId } };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// Soft delete (API sets deleted_at — hard rule #4).
export async function deleteCommitment(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/pulse/commitments/${id}`, { method: 'DELETE' });
    revalidatePath('/pipeline');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}
