// The one place this package talks HTTP.
//
// Everything the MCP server can do is a request to the app-key surface of the
// Fibre API — the default-deny route table in
// apps/api/src/middleware/app-context.ts. There is deliberately no other
// credential here: no Supabase key, no user JWT. An app key carries ONE app's
// authority in ONE workspace, bounded by scopes, and that is exactly the
// authority an assistant acting on someone's behalf should have. A user JWT
// would be the pre-v0.14.0 problem — the user's full authority everywhere —
// back again.

export const DEFAULT_API = 'https://thefibre-api.fly.dev';
export const TOKEN_PREFIX = 'fibre_ak_';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface FibreClientOptions {
  /** Base URL of the Fibre API, no trailing slash. */
  apiUrl?: string;
  /** The app key, `fibre_ak_…`. Sent as a bearer token on every request. */
  appKey: string;
  /** Injected for tests; defaults to global fetch. */
  fetch?: FetchLike;
}

export interface WhoAmI {
  auth: string;
  app_slug: string;
  workspace_id: string;
  scopes: string[];
}

/** A non-2xx answer from the API, kept whole so the tool can show it. */
export class FibreApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly body: unknown,
    readonly retryAfter: string | null = null,
  ) {
    super(`${method} ${path} → ${status}`);
    this.name = 'FibreApiError';
  }

  /** What the assistant sees. Plain words first, the API's own detail after. */
  describe(): string {
    const detail =
      typeof this.body === 'string' ? this.body : JSON.stringify(this.body, null, 2);
    const head =
      this.status === 401
        ? 'The app key was not accepted (401).'
        : this.status === 403
          ? 'This key is not allowed to do that (403) — a scope or route outside what it was minted for.'
          : this.status === 404
            ? 'Not found (404).'
            : this.status === 429
              ? `Rate-limited (429)${this.retryAfter ? `, retry after ${this.retryAfter}s` : ''}.`
              : `The API answered ${this.status}.`;
    return `${head}\n${this.method} ${this.path}\n${detail}`;
  }
}

export class FibreClient {
  readonly apiUrl: string;
  private readonly appKey: string;
  private readonly fetchImpl: FetchLike;

  constructor(opts: FibreClientOptions) {
    this.apiUrl = (opts.apiUrl ?? DEFAULT_API).replace(/\/+$/, '');
    this.appKey = opts.appKey;
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
    if (!this.appKey.startsWith(TOKEN_PREFIX)) {
      throw new Error(
        `FIBRE_APP_KEY does not look like an app key (expected it to start with ${TOKEN_PREFIX}). ` +
          'Mint one at Settings → Apps → your app → Manage API keys.',
      );
    }
  }

  /** Verify the credential and learn what it may do. */
  whoami(): Promise<WhoAmI> {
    return this.request<WhoAmI>('GET', '/api/v1/apps/whoami');
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<T> {
    let url = this.apiUrl + path;
    if (query) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null || v === '') continue;
        qs.set(k, String(v));
      }
      const s = qs.toString();
      if (s) url += `?${s}`;
    }
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.appKey}`,
      accept: 'application/json',
    };
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await this.fetchImpl(url, init);
    const text = await res.text();
    let parsed: unknown = text;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    } else {
      parsed = null;
    }
    // 207 is a real answer for the bulk link route: partial success, per item.
    if (!res.ok && res.status !== 207) {
      throw new FibreApiError(res.status, method, path, parsed, res.headers.get('retry-after'));
    }
    return parsed as T;
  }
}
