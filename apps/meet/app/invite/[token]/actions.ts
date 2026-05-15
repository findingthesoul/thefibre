'use server';

import { apiFetch, ApiError } from '@/lib/api';

export async function acceptInvite(
  token: string,
): Promise<{ ok?: boolean; error?: string; team_slug?: string }> {
  try {
    const r = await apiFetch<{ team_slug: string | null }>(
      `/api/v1/meet/teams/accept-invite/${encodeURIComponent(token)}`,
      { method: 'POST' },
    );
    return { ok: true, team_slug: r.team_slug ?? undefined };
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
}
