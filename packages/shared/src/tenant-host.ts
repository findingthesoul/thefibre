// A customer's own host for the public pages (docs/domain-package.md, part 2):
// what the apps' middleware does with a request that did not arrive on the
// app's own address.
//
// Pure decisions here, framework objects injected, so the rule is tested
// once and both Meet and Thread run the same one. The API answers "what does
// this host serve" (`GET /api/v1/public/domains/resolve?host=`), verified
// hosts only; this module caches that answer per host for a minute, negative
// answers included, so a request costs the API nothing most of the time.
//
// The rule for a verified tenant host, in order:
//   1. a path the app serves for everyone and that must not be prefixed
//      (`/_next`, `/api`, `/embed`, `/certificate`, …)        → pass through
//   2. a signed-in or sign-in path (`/my`, `/auth`, `/sso`, `/dashboard`,
//      `/settings`, `/invite`, …) → 307 to the app's own origin: the session
//      cookie lives on our apex and a sign-in on a foreign host silently
//      fails (packages/shared/src/supabase-session.ts)
//   3. a path already under the owner's root (`/{root}`, `/{root}/…`) — the
//      apps' own links are relative WITH the segment                → pass
//   4. everything else → rewrite to `/{root}{path}`: `/` becomes the owner
//      page, `/intro` the booking flow for `intro`.
// An unknown or unverified host is not a tenant host: nothing happens, the
// request is served exactly as if it had arrived on our own address (Vercel
// would not route an unregistered host to us anyway).
//
// Old links keep working forever: none of this runs for the app's own hosts.

export type TenantApp = 'fibre-meet' | 'the-thread';

export type ResolvedTenant = { app: TenantApp; root_slug: string; workspace_slug: string | null };

/** First path segments the app serves regardless of owner; never prefixed. */
export const TENANT_PASS_THROUGH = new Set([
  '_next',
  'api',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'manifest.webmanifest',
  'embed',
  'embed.js',
  'certificate',
  'docs',
  'sw.js',
  'offline',
]);

/** First path segments that belong to a signed-in or signing-in person;
 *  on a tenant host they go to the app's own origin. */
export const TENANT_REDIRECT_TO_CANONICAL = new Set([
  'my',
  'auth',
  'sso',
  'dashboard',
  'settings',
  'invite',
  'sign-in',
  'login',
  'admin',
  'bookings',
  'meeting-types',
  'teams',
  'availability',
  'threads',
  'participants',
  'invoices',
  'internal-team',
]);

export type TenantDecision =
  | { kind: 'pass' }
  | { kind: 'redirect'; url: string }
  | { kind: 'rewrite'; pathname: string };

/** The rule above, for one request on a VERIFIED tenant host. */
export function decideTenantPath(
  pathname: string,
  search: string,
  root: string,
  canonicalOrigin: string,
): TenantDecision {
  const clean = pathname.replace(/\/{2,}/g, '/');
  const first = clean.split('/')[1] ?? '';
  if (first && TENANT_PASS_THROUGH.has(first)) return { kind: 'pass' };
  if (first && TENANT_REDIRECT_TO_CANONICAL.has(first)) {
    return { kind: 'redirect', url: `${canonicalOrigin.replace(/\/$/, '')}${clean}${search}` };
  }
  if (clean === `/${root}` || clean.startsWith(`/${root}/`)) return { kind: 'pass' };
  return { kind: 'rewrite', pathname: clean === '/' ? `/${root}` : `/${root}${clean}` };
}

/** Is this request host one of the app's own (or a dev / preview host)?
 *  Then nothing here applies. Exact matches only. */
export function isOwnHost(host: string, ownHosts: readonly string[]): boolean {
  const h = host.toLowerCase().replace(/:\d+$/, '');
  if (!h || h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return true;
  if (h.endsWith('.vercel.app')) return true;
  return ownHosts.some((o) => o.toLowerCase().replace(/:\d+$/, '') === h);
}

type Fetch = typeof fetch;

/** Per-process cache of host → tenant (or null), a minute each way. */
const cache = new Map<string, { until: number; value: ResolvedTenant | null }>();
const TTL_MS = 60_000;

/** Ask the API what a host serves. Unknown, unverified, wrong app, or an API
 *  that does not answer → null, and a public page is served as on our own
 *  host — never an error page because a lookup hiccupped. */
export async function resolveTenant(
  host: string,
  app: TenantApp,
  apiBase: string,
  fetchImpl: Fetch = fetch,
  now = Date.now(),
): Promise<ResolvedTenant | null> {
  const key = `${app}|${host.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && hit.until > now) return hit.value;
  let value: ResolvedTenant | null = null;
  try {
    const r = await fetchImpl(`${apiBase.replace(/\/$/, '')}/api/v1/public/domains/resolve?host=${encodeURIComponent(host)}`, {
      headers: { Accept: 'application/json' },
    });
    if (r.ok) {
      const j = (await r.json()) as Partial<ResolvedTenant>;
      if (j.app === app && typeof j.root_slug === 'string' && j.root_slug) {
        value = { app: j.app, root_slug: j.root_slug, workspace_slug: j.workspace_slug ?? null };
      }
    }
  } catch {
    // Keep a stale positive answer if we have one; otherwise not a tenant.
    if (hit) return hit.value;
  }
  cache.set(key, { until: now + TTL_MS, value });
  return value;
}

/** For tests. */
export function _clearTenantCache(): void {
  cache.clear();
}

export type TenantRequest = {
  nextUrl: { hostname: string; host: string; pathname: string; search: string };
  headers: { get(name: string): string | null };
};

/**
 * The step a middleware runs FIRST. Returns what to do, or null when the
 * request is on our own host or the host is not a verified tenant. The
 * framework objects (how to rewrite, how to redirect) are the caller's.
 */
export function tenantHostStep<Req extends TenantRequest, Res>(deps: {
  app: TenantApp;
  /** The app's own public origin (appUrl), where sign-in lives. */
  canonicalOrigin: string;
  /** Every host that is "us" for this app: production, staging. */
  ownHosts: readonly string[];
  apiBase: string;
  rewrite: (request: Req, pathname: string, tenant: ResolvedTenant) => Res;
  redirect: (url: string) => Res;
  fetchImpl?: Fetch;
}): (request: Req) => Promise<{ final: Res } | { respond: (request: Req) => Res } | null> {
  return async (request) => {
    // The host the browser asked for. Behind Vercel the forwarded header is
    // the truth; nextUrl.host is the same in practice but belt and braces.
    const host = (request.headers.get('x-forwarded-host') ?? request.nextUrl.host).split(',')[0]!.trim();
    if (isOwnHost(host, deps.ownHosts)) return null;
    const tenant = await resolveTenant(host.replace(/:\d+$/, ''), deps.app, deps.apiBase, deps.fetchImpl);
    if (!tenant) return null;
    const d = decideTenantPath(request.nextUrl.pathname, request.nextUrl.search, tenant.root_slug, deps.canonicalOrigin);
    if (d.kind === 'pass') return null;
    if (d.kind === 'redirect') return { final: deps.redirect(d.url) };
    return { respond: (req) => deps.rewrite(req, d.pathname, tenant) };
  };
}
