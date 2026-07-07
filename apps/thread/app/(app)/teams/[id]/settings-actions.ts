'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, errorMessage } from '@/lib/api';

type Result = { ok: true } | { ok: false; error: string };

export async function updateTeam(
  teamId: string,
  patch: { description?: string | null; payout_destination?: 'workspace' | 'lead' },
): Promise<Result> {
  try {
    await apiFetch(`/api/v1/thread/teams/${teamId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath(`/teams/${teamId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
