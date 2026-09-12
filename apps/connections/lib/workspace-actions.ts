'use server';

// Switching which workspace you are acting in.
//
// The workspace is carried in the access token — every RLS policy asks the
// token, not the request — so changing it is two steps that must happen in
// order: record the choice here, then let the browser fetch a new token so the
// access-token hook can stamp the new workspace into it.
//
// The action only does the first. It cannot mint the caller a token; the
// Supabase client in the browser does that with refreshSession(). The client is
// told to, by `refresh_required` coming back from the API.
//
// Membership is checked by the API, not here. `user_active_workspace` has RLS
// on with no policies at all, so nothing but the service role can write it —
// which means a client that lied to this action still gets nowhere.
//
// The choice is one per account, not one per app: switch here and The Fibre
// and every other app follow on their next token.

import { apiFetch, ApiError } from './api';

export async function switchWorkspace(
  workspaceId: string,
): Promise<{ error?: string }> {
  try {
    await apiFetch('/api/v1/auth/workspace', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: workspaceId }),
    });
    return {};
  } catch (e) {
    if (e instanceof ApiError) {
      const body = e.body as { error?: string } | undefined;
      return { error: body?.error ?? `API ${e.status}` };
    }
    return { error: 'could not switch workspace' };
  }
}
