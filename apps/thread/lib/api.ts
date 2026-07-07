import { serverSupabase } from './supabase/server';

// Thread identifies itself to the Fibre API as 'the-thread'.
const APP_ID = 'the-thread';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { appId?: string } = {},
): Promise<T> {
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new ApiError(401, 'no session');

  const { appId = APP_ID, headers, ...rest } = init;

  const res = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
      'X-App-ID': appId,
      ...headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let body: unknown;
    // Read the body ONCE as text, then try JSON — res.json() followed by
    // res.text() throws "Body is unusable" when the payload isn't JSON.
    const raw = await res.text().catch(() => '');
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
    throw new ApiError(res.status, `API ${res.status}: ${path}`, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Human-readable message from a failed API call — the shared version of a
 *  helper that had been copy-pasted into nine action files (with drift). */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: unknown } | undefined;
    if (typeof body?.error === 'string') return body.error;
    if (body?.error) return JSON.stringify(body.error);
    return e.message;
  }
  return e instanceof Error ? e.message : 'unknown error';
}
