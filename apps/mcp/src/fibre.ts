// The one HTTP client, and the one place a session is minted.
//
// Everything a tool reads goes through `get()`, as the seat: a Supabase user
// JWT in `Authorization`, the platform's slug in `X-App-ID`, and the API's
// own RLS deciding what comes back. This file never holds an app key and
// never talks to Supabase for data — the service key, when present, mints a
// session and does nothing else.

import { createClient } from '@supabase/supabase-js';
import type { Config } from './env.js';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: string,
  ) {
    super(`API ${status} on ${path}: ${body.slice(0, 300)}`);
  }
}

type Session = { jwt: string; expiresAt: number };

/** Decode a JWT's `exp` without verifying it — we only need to know when to re-mint. */
export function jwtExpiry(jwt: string): number {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export class Fibre {
  private session: Session | null = null;

  constructor(private readonly cfg: Config) {}

  /** Who this client acts as, for the startup banner. */
  describe(): string {
    const c = this.cfg.credentials;
    return c.mode === 'jwt'
      ? `a pasted user token (expires ${new Date(jwtExpiry(c.jwt)).toISOString()})`
      : `a minted session for ${c.userEmail}`;
  }

  private async token(): Promise<string> {
    const c = this.cfg.credentials;
    if (c.mode === 'jwt') return c.jwt;
    // Re-mint a minute before expiry rather than on the first 401, so a
    // long-running chat never sees a stale token mid-question.
    if (this.session && this.session.expiresAt - Date.now() > 60_000) return this.session.jwt;
    this.session = await mintSession(c.supabaseUrl, c.anonKey, c.serviceKey, c.userEmail);
    return this.session.jwt;
  }

  async get<T = unknown>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(this.cfg.api + path);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'X-App-ID': this.cfg.appId,
        Accept: 'application/json',
      },
    });
    const text = await res.text();
    if (!res.ok) throw new ApiError(res.status, path, text);
    return (text ? JSON.parse(text) : null) as T;
  }
}

/**
 * The supported way to get a real user session without a browser:
 * admin.generateLink → verifyOtp. No email is sent. This is exactly what
 * apps/api/scripts/verify-external-app.mjs does for its admin steps, retried
 * for the same reason it retries there (one unexplained "link expired" on
 * 2026-09-14). The custom_access_token_hook stamps workspace_id and
 * app_user_id, so the token is the one the browser would carry.
 */
export async function mintSession(
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string,
  email: string,
): Promise<Session> {
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let last: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (error) throw new Error(`generateLink failed for ${email}: ${error.message}`);
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error: vErr } = await anon.auth.verifyOtp({
      type: 'magiclink',
      token_hash: link.properties.hashed_token,
    });
    if (!vErr && data.session) {
      const jwt = data.session.access_token;
      return { jwt, expiresAt: jwtExpiry(jwt) || Date.now() + 55 * 60_000 };
    }
    last = vErr;
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  throw new Error(`verifyOtp failed after 3 attempts: ${(last as Error | undefined)?.message ?? 'unknown'}`);
}
