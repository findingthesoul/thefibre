import { serverSupabase } from './supabase/server';

const PLATFORM_APP_ID = 'fibre-platform';

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

  const { appId = PLATFORM_APP_ID, headers, ...rest } = init;

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
  return res.json() as Promise<T>;
}
