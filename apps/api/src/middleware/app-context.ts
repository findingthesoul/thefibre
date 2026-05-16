import type { Context, MiddlewareHandler } from 'hono';
import { jwtVerify, createRemoteJWKSet } from 'jose';

export type AppId =
  | 'fibre-platform'
  | 'fibre-meet'
  | 'the-thread'
  | 'fibre-sales'
  | 'fibre-learn';

const VALID_APP_IDS: ReadonlySet<AppId> = new Set([
  'fibre-platform',
  'fibre-meet',
  'the-thread',
  'fibre-sales',
  'fibre-learn',
]);

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
  appId: AppId;
  jwt: string;
};

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
  if (!appHeader || !VALID_APP_IDS.has(appHeader as AppId)) {
    return problem(c, 400, 'missing-app-id', 'X-App-ID header required');
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
      appId: appHeader as AppId,
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
