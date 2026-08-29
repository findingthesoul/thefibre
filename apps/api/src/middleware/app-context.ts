import type { Context, MiddlewareHandler } from 'hono';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { adminClient } from '../db.js';
import {
  looksLikeAppKey,
  resolveAppKey,
  touchAppKey,
  type AppScope,
} from '../lib/app-keys.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const jwks = supabaseUrl
  ? createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`))
  : null;

export type RequestContext = {
  /**
   * `public.user.id` — the platform user. Use this for any FK to `user(id)`.
   * EMPTY STRING when `auth === 'app_key'`: there is no human behind the
   * request. Use `actorUserId(ctx)` for anything that writes a user FK.
   */
  userId: string;
  /** `auth.users.id` (JWT `sub`). Empty when `auth === 'app_key'`. */
  authUserId: string;
  workspaceId: string;
  /**
   * The app slug. From the X-App-ID header for user sessions (validated
   * against `public.app`), or from the key itself for app-key requests.
   */
  appId: string;
  /** The user's JWT. Empty when `auth === 'app_key'` — there is no user session. */
  jwt: string;
  /** How this request authenticated. */
  auth: 'user' | 'app_key';
  /**
   * Scopes the credential carries. `null` for a user session, which acts with
   * the user's own authority and is bounded by RLS instead.
   */
  scopes: readonly AppScope[] | null;
  appKeyId: string | null;
};

/**
 * The `public.user.id` to attribute a write to, or null when the actor is an
 * app rather than a person. Every user FK written from a route that app keys
 * can reach must go through this.
 */
export function actorUserId(ctx: RequestContext): string | null {
  return ctx.auth === 'user' && ctx.userId ? ctx.userId : null;
}

// Cache of registered app slugs. Populated lazily; refreshed on miss so a
// newly-approved third-party app becomes accepted within one extra DB hit.
let appSlugCache: Set<string> | null = null;
let appSlugCacheLoadedAt = 0;
const APP_SLUG_CACHE_TTL_MS = 5 * 60 * 1000;

async function loadAppSlugs(): Promise<Set<string>> {
  // Only approved apps may present an X-App-ID. A pending registration can be
  // reviewed, but it cannot yet act.
  const { data, error } = await adminClient.from('app').select('slug').eq('status', 'approved');
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
  // Cache miss: refresh once in case an app was just approved.
  if (!stale) {
    slugs = await loadAppSlugs();
    return slugs.has(slug);
  }
  return false;
}

/** Called after an approval/suspension so the change takes effect immediately. */
export function invalidateAppSlugCache(): void {
  appSlugCache = null;
  appSlugCacheLoadedAt = 0;
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
  '/api/v1/apps/register', // POST only — an app registering itself has no credential yet
]);

const PUBLIC_PATH_METHODS = new Map<string, ReadonlySet<string>>([
  ['/api/v1/signup-requests', new Set(['POST'])],
  ['/api/v1/auth-hook/email', new Set(['POST'])],
  ['/api/v1/apps/register', new Set(['POST'])],
]);

// Path prefixes that bypass auth entirely. /meet/public/* serves the
// public booking-page flow where invitees have no Fibre account.
const PUBLIC_PREFIXES = [
  '/api/v1/meet/public/',
  '/api/v1/meet/google/auth-callback',
  // Stripe webhook — signature-verified inside the handler.
  '/api/v1/meet/stripe-webhook',
  // The Thread public pages (organiser page, thread page, enrolment flow)
  // + its Stripe webhook (signature-verified inside the handler).
  '/api/v1/thread/public/',
  '/api/v1/thread/stripe-webhook',
];

// ---------------------------------------------------------------------------
// What an app key is allowed to reach — brief §3.
//
// DEFAULT DENY. A key can only touch routes listed here, and only with the
// scope named. Everything else 403s regardless of what scopes the key holds,
// so widening an app's surface is a deliberate edit to this table rather than
// a side effect of granting a scope.
//
// Note what is deliberately absent: the general /persons and /organisations
// routes. Those run on `userClient(ctx.jwt)` and are bounded by RLS acting on
// a real user; there is no user behind an app key. The app-facing equivalents
// under /apps/:slug/* filter by workspace explicitly and are safe to expose.
// ---------------------------------------------------------------------------
type AppKeyRoute = { method: string; test: RegExp; scope: AppScope | null };

const APP_KEY_ROUTES: AppKeyRoute[] = [
  // Entity links
  { method: 'POST', test: /^\/api\/v1\/apps\/[^/]+\/links$/, scope: 'write:persons' },
  { method: 'POST', test: /^\/api\/v1\/apps\/[^/]+\/links:bulk$/, scope: 'write:persons' },
  { method: 'POST', test: /^\/api\/v1\/apps\/[^/]+\/links\/bulk$/, scope: 'write:persons' },
  { method: 'GET', test: /^\/api\/v1\/apps\/[^/]+\/links\/[^/]+\/[^/]+$/, scope: 'read:persons' },
  { method: 'GET', test: /^\/api\/v1\/apps\/[^/]+\/persons\/[^/]+\/[^/]+$/, scope: 'read:persons' },
  { method: 'GET', test: /^\/api\/v1\/apps\/[^/]+\/organisations\/[^/]+\/[^/]+$/, scope: 'read:organisations' },
  // Connecting a person to an organisation writes to the organisation's own
  // graph, so it is gated on write:organisations rather than write:persons.
  { method: 'POST', test: /^\/api\/v1\/apps\/[^/]+\/memberships$/, scope: 'write:organisations' },
  // Crediting a host writes to the thread, not to the person — the person is
  // only named. write:programs is the scope that owns thread content.
  { method: 'POST', test: /^\/api\/v1\/apps\/[^/]+\/thread\/threads\/[^/]+\/hosts$/, scope: 'write:programs' },
  // Manifest — an app reading back what it declared.
  { method: 'GET', test: /^\/api\/v1\/apps\/[^/]+\/manifest$/, scope: null },
  { method: 'PUT', test: /^\/api\/v1\/apps\/[^/]+\/manifest$/, scope: null },
  // Activity — the sanctioned data-wall crossing.
  { method: 'POST', test: /^\/api\/v1\/activities$/, scope: 'write:activities' },
  { method: 'GET', test: /^\/api\/v1\/activities$/, scope: 'read:activities' },
  // The Thread — publish a programme as a public page, edit it, see who
  // registered. No write:enrolments anywhere: registration comes from the
  // public form, never from an app.
  { method: 'GET', test: /^\/api\/v1\/apps\/[^/]+\/thread\/templates$/, scope: 'read:programs' },
  { method: 'POST', test: /^\/api\/v1\/apps\/[^/]+\/thread\/threads$/, scope: 'write:programs' },
  { method: 'GET', test: /^\/api\/v1\/apps\/[^/]+\/thread\/threads$/, scope: 'read:programs' },
  { method: 'GET', test: /^\/api\/v1\/apps\/[^/]+\/thread\/threads\/[^/]+$/, scope: 'read:programs' },
  { method: 'PATCH', test: /^\/api\/v1\/apps\/[^/]+\/thread\/threads\/[^/]+$/, scope: 'write:programs' },
  { method: 'GET', test: /^\/api\/v1\/apps\/[^/]+\/thread\/threads\/[^/]+\/enrolments$/, scope: 'read:enrolments' },
  // Engagements. The WRITE is the only thing on this surface that can cause an
  // email to reach a human, so it carries its own scope rather than riding on
  // write:programs — see docs/brief-thread-engagements-from-apps.md §5.
  { method: 'POST', test: /^\/api\/v1\/apps\/[^/]+\/thread\/threads\/[^/]+\/engagements$/, scope: 'write:messages' },
  { method: 'GET', test: /^\/api\/v1\/apps\/[^/]+\/thread\/threads\/[^/]+\/engagements$/, scope: 'read:programs' },
  { method: 'PATCH', test: /^\/api\/v1\/apps\/[^/]+\/thread\/engagements\/[^/]+$/, scope: 'write:messages' },
  { method: 'DELETE', test: /^\/api\/v1\/apps\/[^/]+\/thread\/engagements\/[^/]+$/, scope: 'write:messages' },

  // Who am I — lets an app verify its credential and see its own scopes.
  { method: 'GET', test: /^\/api\/v1\/apps\/whoami$/, scope: null },
  // Flow — routes/app-flow.ts. Consume only: reading a flow's shape, and
  // owning runs against it. Nothing here edits a definition, and every
  // handler additionally scopes to runs whose source_app is the key's app.
  { method: 'GET', test: /^\/api\/v1\/apps\/[^/]+\/flow\/flows$/, scope: 'read:flows' },
  { method: 'GET', test: /^\/api\/v1\/apps\/[^/]+\/flow\/flows\/[^/]+$/, scope: 'read:flows' },
  { method: 'POST', test: /^\/api\/v1\/apps\/[^/]+\/flow\/flows\/[^/]+\/runs$/, scope: 'write:flow_runs' },
  { method: 'GET', test: /^\/api\/v1\/apps\/[^/]+\/flow\/runs$/, scope: 'read:flows' },
  { method: 'GET', test: /^\/api\/v1\/apps\/[^/]+\/flow\/runs\/[^/]+$/, scope: 'read:flows' },
  { method: 'POST', test: /^\/api\/v1\/apps\/[^/]+\/flow\/runs\/[^/]+\/move$/, scope: 'write:flow_runs' },
  { method: 'POST', test: /^\/api\/v1\/apps\/[^/]+\/flow\/runs\/[^/]+\/tasks$/, scope: 'write:flow_runs' },
  { method: 'PATCH', test: /^\/api\/v1\/apps\/[^/]+\/flow\/tasks\/[^/]+$/, scope: 'write:flow_runs' },
  { method: 'GET', test: /^\/api\/v1\/apps\/[^/]+\/flow\/runs\/[^/]+\/steps\/[^/]+\/note$/, scope: 'read:flows' },
  { method: 'PUT', test: /^\/api\/v1\/apps\/[^/]+\/flow\/runs\/[^/]+\/steps\/[^/]+\/note$/, scope: 'write:flow_runs' },
];

/**
 * A link write against an organisation mapping needs write:organisations, not
 * write:persons. The route table can't see the body, so the handler re-checks.
 * Exported so routes can demand a scope the table couldn't determine.
 */
export function hasScope(ctx: RequestContext, scope: AppScope): boolean {
  if (ctx.auth === 'user') return true; // user sessions are bounded by RLS
  return (ctx.scopes ?? []).includes(scope);
}

export function scopeDenied(c: Context, scope: AppScope) {
  return problem(
    c,
    403,
    'missing-scope',
    `this credential does not carry the "${scope}" scope`,
  );
}

export const appContext: MiddlewareHandler = async (c, next) => {
  if (PUBLIC_PATHS.has(c.req.path)) {
    const allowedMethods = PUBLIC_PATH_METHODS.get(c.req.path);
    if (!allowedMethods || allowedMethods.has(c.req.method)) {
      return next();
    }
  }
  if (PUBLIC_PREFIXES.some((p) => c.req.path.startsWith(p))) return next();

  const auth = c.req.header('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return problem(c, 401, 'missing-token', 'Bearer token required');
  }
  const bearer = auth.slice('Bearer '.length);

  // -------------------------------------------------------------------------
  // App-key path — no user, no browser session.
  // -------------------------------------------------------------------------
  if (looksLikeAppKey(bearer)) {
    const key = await resolveAppKey(bearer);
    if (!key) {
      return problem(
        c,
        401,
        'invalid-app-key',
        'app key unknown, revoked, or its app is not approved / not activated on that workspace',
      );
    }

    // An X-App-ID that disagrees with the key is a configuration error worth
    // surfacing loudly rather than silently preferring one of the two.
    const appHeader = c.req.header('x-app-id');
    if (appHeader && appHeader !== key.appSlug) {
      return problem(
        c,
        400,
        'app-id-mismatch',
        `X-App-ID "${appHeader}" does not match the app this key belongs to ("${key.appSlug}")`,
      );
    }

    const route = APP_KEY_ROUTES.find(
      (r) => r.method === c.req.method && r.test.test(c.req.path),
    );
    if (!route) {
      return problem(
        c,
        403,
        'not-app-accessible',
        `${c.req.method} ${c.req.path} is not reachable with an app key`,
      );
    }
    if (route.scope && !key.scopes.includes(route.scope)) {
      return problem(
        c,
        403,
        'missing-scope',
        `this credential does not carry the "${route.scope}" scope`,
      );
    }

    // The :slug in an /apps/:slug/* path must be the key's own app. Without
    // this a key for app A could write links attributed to app B.
    const slugInPath = c.req.path.match(/^\/api\/v1\/apps\/([^/:]+)(\/|:|$)/)?.[1];
    if (slugInPath && slugInPath !== 'register' && slugInPath !== 'whoami' && slugInPath !== key.appSlug) {
      return problem(
        c,
        403,
        'wrong-app',
        `this key belongs to "${key.appSlug}" and cannot act as "${slugInPath}"`,
      );
    }

    touchAppKey(key.keyId);
    c.set('ctx', {
      userId: '',
      authUserId: '',
      workspaceId: key.workspaceId,
      appId: key.appSlug,
      jwt: '',
      auth: 'app_key',
      scopes: key.scopes,
      appKeyId: key.keyId,
    });
    return next();
  }

  // -------------------------------------------------------------------------
  // User-session path — a Supabase JWT, as before.
  // -------------------------------------------------------------------------
  const appHeader = c.req.header('x-app-id');
  if (!appHeader) {
    return problem(c, 400, 'missing-app-id', 'X-App-ID header required');
  }
  if (!(await isKnownAppSlug(appHeader))) {
    return problem(
      c,
      400,
      'unknown-app-id',
      `X-App-ID "${appHeader}" is not a registered, approved app`,
    );
  }

  if (!jwks) {
    return problem(c, 500, 'auth-not-configured', 'JWKS not configured');
  }

  try {
    const { payload } = await jwtVerify(bearer, jwks, {
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
      jwt: bearer,
      auth: 'user',
      scopes: null,
      appKeyId: null,
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
    status as 400 | 401 | 403 | 500,
    { 'Content-Type': 'application/problem+json' },
  );
}
