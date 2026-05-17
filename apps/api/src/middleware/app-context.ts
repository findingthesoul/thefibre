import type { Context, MiddlewareHandler } from 'hono';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { adminClient } from '../db.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const jwks = supabaseUrl
  ? createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`))
  : null;

export type RequestContext = {
  /** `public.user.id` — the platform user. Use this for any FK to `user(id)`. */
  userId: string;
  /** `auth.users.id` (JWT `sub`). Use only when interacting with Supabase Auth itself. */
  authUserId: string;
  workspaceId: string;
  /**
   * The slug from the X-App-ID header. Validated against `public.app` —
   * any registered app slug is accepted, not just first-party ones, so
   * third-party connectors can identify themselves once an admin has
   * inserted their app row.
   */
  appId: string;
  jwt: string;
};

// Cache of registered app slugs. Populated lazily; refreshed on miss so a
// newly-inserted third-party app becomes accepted within one extra DB hit.
let appSlugCache: Set<string> | null = null;
let appSlugCacheLoadedAt = 0;
const APP_SLUG_CACHE_TTL_MS = 5 * 60 * 1000;

async function loadAppSlugs(): Promise<Set<string>> {
  const { data, error } = await adminClient.from('app').select('slug');
  if (error) {
    console.error('[app-context] failed to load app slugs', error);
    return appSlugCache ?? new Set();
  }
  const set = new Set((data ?? []).map((r) => r.slug as string));
  appSlugCache = set;
  appSlugCacheLoadedAt = Date.now();
  return set;
}

async function isKnownAppSlug(slug: string): Promise<boolean> {
  const stale = !appSlugCache || Date.now() - appSlugCacheLoadedAt > APP_SLUG_CACHE_TTL_MS;
  let slugs = stale ? await loadAppSlugs() : appSlugCache!;
  if (slugs.has(slug)) return true;
  // Cache miss: refresh once in case a new app was just registered.
  if (!stale) {
    slugs = await loadAppSlugs();
    return slugs.has(slug);
  }
  return false;
}

declare module 'hono' {
  interface ContextVariableMap {
    ctx: RequestContext;
  }
}

const PUBLIC_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/sso/resolve', // gated by its own X-SSO-Secret header, not JWT
  '/api/v1/sso/access-check', // same — server-to-server, secret-gated
  '/api/v1/signup-requests', // POST only — applicants have no account yet
  '/api/v1/auth-hook/email', // Supabase Send Email Hook; HMAC-verified
]);

const PUBLIC_PATH_METHODS = new Map<string, ReadonlySet<string>>([
  ['/api/v1/signup-requests', new Set(['POST'])],
  ['/api/v1/auth-hook/email', new Set(['POST'])],
]);

// Path prefixes that bypass auth entirely. /meet/public/* serves the
// public booking-page flow where invitees have no Fibre account.
const PUBLIC_PREFIXES = [
  '/api/v1/meet/public/',
  '/api/v1/meet/google/auth-callback',
  // Stripe webhook — signature-verified inside the handler.
  '/api/v1/meet/stripe-webhook',
];

export const appContext: MiddlewareHandler = async (c, next) => {
  if (PUBLIC_PATHS.has(c.req.path)) {
    const allowedMethods = PUBLIC_PATH_METHODS.get(c.req.path);
    if (!allowedMethods || allowedMethods.has(c.req.method)) {
      return next();
    }
  }
  if (PUBLIC_PREFIXES.some((p) => c.req.path.startsWith(p))) return next();

  const appHeader = c.req.header('x-app-id');
  if (!appHeader) {
    return problem(c, 400, 'missing-app-id', 'X-App-ID header required');
  }
  if (!(await isKnownAppSlug(appHeader))) {
    return problem(c, 400, 'unknown-app-id', `X-App-ID "${appHeader}" not registered in public.app`);
  }

  const auth = c.req.header('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return problem(c, 401, 'missing-token', 'Bearer token required');
  }
  if (!jwks) {
    return problem(c, 500, 'auth-not-configured', 'JWKS not configured');
  }

  const jwt = auth.slice('Bearer '.length);
  try {
    const { payload } = await jwtVerify(jwt, jwks, {
      audience: process.env.API_JWT_AUDIENCE ?? 'authenticated',
    });
    const workspaceId = payload.workspace_id as string | undefined;
    const appUserId = payload.app_user_id as string | undefined;
    if (!payload.sub || !workspaceId || !appUserId) {
      return problem(c, 401, 'invalid-claims', 'sub, workspace_id, and app_user_id required (sign out and sign back in to refresh)');
    }
    c.set('ctx', {
      userId: appUserId,
      authUserId: payload.sub,
      workspaceId,
      appId: appHeader,
      jwt,
    });
    return next();
  } catch {
    return problem(c, 401, 'invalid-token', 'JWT verification failed');
  }
};

function problem(c: Context, status: number, type: string, detail: string) {
  return c.json(
    {
      type: `https://thefibre.app/errors/${type}`,
      title: type,
      status,
      detail,
    },
    status as 400 | 401 | 500,
    { 'Content-Type': 'application/problem+json' },
  );
}
