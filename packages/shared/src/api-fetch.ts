// The ONE way a Next.js app calls the Fibre API on the server.
//
// Until 2026-09-14 seven apps each carried a 50-line lib/api.ts that differed
// only in the app id they announce in X-App-ID — and they had drifted: Thread
// alone had grown errorMessage() ("copy-pasted into nine action files, with
// drift"), and only web had the 204 comment. The fetch, the error class and
// the message helper live here; each app keeps a binding of a few lines that
// supplies what only it knows — its app id and how it reads the session.
//
// "Shared decides WHAT, the caller decides HOW": this module never imports
// next/headers. The session getter is injected, so the same code serves a
// server component (cookies via @supabase/ssr) and, one day, a script.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

/** Human-readable message from a failed API call, for forms and toasts. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: unknown } | undefined;
    if (typeof body?.error === 'string') return body.error;
    if (body?.error) return JSON.stringify(body.error);
    return e.message;
  }
  return e instanceof Error ? e.message : 'unknown error';
}

export type ApiInit = RequestInit & {
  /** Override the app this call is made as (rare: the platform on behalf of an app). */
  appId?: string;
};

export type ApiFetch = <T = unknown>(path: string, init?: ApiInit) => Promise<T>;

export function createApiFetch({
  appId,
  baseUrl,
  getAccessToken,
}: {
  /** The slug this app announces in X-App-ID; RLS gates curator rows on it. */
  appId: string;
  /** Defaults to the local API; pass NEXT_PUBLIC_API_BASE_URL from the app. */
  baseUrl?: string;
  /** The current session's JWT, or nothing when signed out. */
  getAccessToken: () => Promise<string | null | undefined>;
}): ApiFetch {
  const base = (baseUrl ?? 'http://localhost:8080').replace(/\/$/, '');
  return async function apiFetch<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
    const token = await getAccessToken();
    if (!token) throw new ApiError(401, 'no session');

    const { appId: overrideAppId, headers, ...rest } = init;
    const res = await fetch(`${base}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-App-ID': overrideAppId ?? appId,
        ...headers,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      // Read the body ONCE as text, then try JSON — res.json() followed by
      // res.text() throws "Body is unusable" when the payload isn't JSON.
      const raw = await res.text().catch(() => '');
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
      throw new ApiError(res.status, `API ${res.status}: ${path}`, body);
    }
    // 204 No Content has no body — undefined cast through T for callers that
    // don't read the response.
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  };
}
