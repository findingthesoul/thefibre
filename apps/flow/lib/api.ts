import { serverSupabase } from './supabase/server';

// Flow identifies itself to the Fibre API as 'fibre-flow'. RLS uses this
// (combined with the user's JWT) to gate the curator rows it can see.
const APP_ID = 'fibre-flow';

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
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    throw new ApiError(res.status, `API ${res.status}: ${path}`, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
