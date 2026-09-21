'use server';

// Disconnect an assistant (an MCP grant) — docs/mcp-personal-access-plan.md.
// Its own file beside actions.ts, which belongs to the Google/room flows.

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export async function revokeAssistant(id: string): Promise<{ ok?: boolean; error?: string }> {
  try {
    await apiFetch(`/api/v1/mcp-auth/grants/${encodeURIComponent(id)}`, { method: 'DELETE' });
    revalidatePath('/settings/connections');
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) {
      const body = e.body as { error?: unknown } | undefined;
      return { error: typeof body?.error === 'string' ? body.error : `API ${e.status}` };
    }
    return { error: 'could not reach the API' };
  }
}
