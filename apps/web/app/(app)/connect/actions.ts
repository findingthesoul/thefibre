'use server';

// The consent decision travels from the person's browser to the EU API as
// the person (their session, X-App-ID fibre-platform). The API validates the
// client and redirect, mints the grant + code on approve, and hands back the
// one URL the browser may go to next. Nothing is decided or stored here.

import { apiFetch, ApiError } from '@/lib/api';

export type ConsentParams = {
  client_id: string;
  redirect_uri: string;
  state?: string | undefined;
  code_challenge: string;
  code_challenge_method: 'S256';
  scope?: string | undefined;
  resource?: string | undefined;
};

export async function decideConsent(
  params: ConsentParams,
  decision: 'approve' | 'deny',
): Promise<{ redirect?: string; error?: string }> {
  try {
    const r = await apiFetch<{ redirect: string }>('/api/v1/mcp-auth/consent', {
      method: 'POST',
      body: JSON.stringify({ ...params, decision }),
    });
    return { redirect: r.redirect };
  } catch (e) {
    if (e instanceof ApiError) {
      const body = e.body as { error?: unknown } | undefined;
      return { error: typeof body?.error === 'string' ? body.error : `API ${e.status}` };
    }
    return { error: 'could not reach the API' };
  }
}
