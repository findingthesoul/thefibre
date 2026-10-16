// Calls to the Members portal API from the BROWSER (/api/v1/membership/portal),
// with the participant's own session token. One helper, so the card dialog and
// the Google card do not each carry a copy (it lived inside card-change.tsx
// until 2026-10-16).
//
// A refusal throws PortalCallError carrying the API's words and its `code`
// (e.g. 'address_taken'), so a caller can answer the specific case.

import { browserSupabase } from '@/lib/supabase/client';
import { toLocale, type Locale } from '@thefibre/shared/i18n';
import { t } from '@/lib/i18n';

export class PortalCallError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

export async function portalCall<T>(path: string, body?: unknown, locale?: Locale): Promise<T> {
  const {
    data: { session },
  } = await browserSupabase().auth.getSession();
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  const res = await fetch(`${base}/api/v1/membership/portal${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: unknown; code?: string };
  if (!res.ok) {
    const msg = typeof json.error === 'string' ? json.error : t(toLocale(locale), 'something_wrong_status', { status: res.status });
    throw new PortalCallError(msg, res.status, json.code);
  }
  return json;
}
