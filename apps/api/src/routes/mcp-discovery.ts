// OAuth discovery for MCP clients — docs/mcp-personal-access-plan.md §3.2.
//
// An MCP client is handed one URL (…/api/v1/mcp). From a 401 there it reads
// the protected-resource document, from that the authorization server, and
// from THAT the endpoints. These two documents are those. Mounted at the
// ORIGIN root (server.ts), outside /api/v1, so the auth middleware never sees
// them; they are static per deployment and carry nothing secret.

import { Hono } from 'hono';

export const mcpDiscoveryRoutes = new Hono();

/**
 * Scopes a person can grant a client. Reads (phase 1) plus the first write
 * (phase 4, Sjoerd's "yes please" 2026-09-25): creating a thread. A write
 * scope is never granted by default — narrowScopes() gives reads when a
 * client asks for nothing specific; a client has to ASK for thread:write and
 * the person sees it in its own words on the consent page.
 */
export const MCP_SCOPES = ['connections:read', 'thread:read', 'thread:write', 'models:read', 'models:write'] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export const MCP_RESOURCE_PATH = '/api/v1/mcp';

/**
 * The public origin of this API. Behind Fly's proxy the request URL is
 * http://…:8080, so the Host header is what the outside world used; https
 * everywhere except a local dev server.
 */
export function publicOrigin(headers: Headers): string {
  const configured = process.env.API_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost:8080';
  const scheme = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? 'http' : 'https';
  return `${scheme}://${host}`;
}

/**
 * The connector address a person pastes into their assistant. Sjoerd,
 * 2026-09-27: "can that be a better link than the one I used" — the one he
 * used was the Fly hostname plus /api/v1/mcp. On a host whose first label is
 * `mcp` (mcp.thefibre.app, mcp.thefibre.tech) the endpoint answers at the
 * ROOT, so the whole address is the hostname. The same code path serves both
 * spellings; only the resource identity differs, and an access token is bound
 * to the one it was minted for.
 */
export function isMcpHost(headers: Headers): boolean {
  const host = (headers.get('x-forwarded-host') ?? headers.get('host') ?? '').toLowerCase();
  return host.startsWith('mcp.');
}

/**
 * A per-workspace connector address: `https://mcp.thefibre.app/<workspace-slug>`.
 *
 * Sjoerd, 2026-10-01: Claude keys a connector by its URL and warned when he
 * added a second workspace on the same address. One address per workspace
 * makes each a distinct connector — and, more importantly, pins the
 * connection to the workspace NAMED IN THE ADDRESS rather than to whichever
 * Fibre tab was current when Allow was pressed (the trap of 2026-09-28).
 * The slug is a path segment on an mcp.* host only; on the fly.dev host the
 * endpoint stays at /api/v1/mcp and knows no slugs.
 */
const WORKSPACE_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
const RESERVED_SLUGS = new Set(['api', 'health', 'oauth', 'connect', 'settings', 'well-known']);
export function isWorkspaceSlug(s: string | undefined | null): s is string {
  return typeof s === 'string' && WORKSPACE_SLUG_RE.test(s) && !RESERVED_SLUGS.has(s);
}

/**
 * The workspace slug named by an RFC 8707 `resource` value a client sent
 * (which, for a slug address, is exactly our metadata `resource`:
 * `https://mcp.<apex>/<slug>`), or null for the plain root/path addresses.
 * Only an mcp.* host carries slugs; anything else is ignored, never trusted.
 */
export function slugFromResource(resource: string | undefined | null): { origin: string; slug: string } | null {
  if (!resource) return null;
  try {
    const u = new URL(resource);
    if (!u.hostname.toLowerCase().startsWith('mcp.')) return null;
    const segs = u.pathname.split('/').filter(Boolean);
    if (segs.length !== 1 || !isWorkspaceSlug(segs[0])) return null;
    return { origin: u.origin, slug: segs[0]! };
  } catch {
    return null;
  }
}

/**
 * Origin, endpoint path and resource identifier for THIS request's host —
 * and, on an mcp.* host, for the workspace slug in the path when there is one.
 * An access token is bound to exactly this `resource`, so a token for one
 * workspace address never opens another.
 */
export function mcpResource(headers: Headers, slug?: string | null): { origin: string; path: string; resource: string } {
  const origin = publicOrigin(headers);
  if (!isMcpHost(headers)) return { origin, path: MCP_RESOURCE_PATH, resource: `${origin}${MCP_RESOURCE_PATH}` };
  const path = isWorkspaceSlug(slug) ? `/${slug}` : '';
  return { origin, path, resource: `${origin}${path}` };
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/api/v1/oauth/authorize`,
    token_endpoint: `${origin}/api/v1/oauth/token`,
    registration_endpoint: `${origin}/api/v1/oauth/register`,
    revocation_endpoint: `${origin}/api/v1/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    // Public clients only: we issue no client secrets, the token endpoint
    // authenticates the code with PKCE. Advertising the confidential methods
    // (which /register does not accept) made Claude register with
    // client_secret_post — a method we named but refuse — and every
    // connection died at "Couldn't register with … sign-in service" (Sjoerd,
    // 2026-09-27, connecting Festival of Trust). Advertise only what we take.
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [...MCP_SCOPES],
    service_documentation: 'https://github.com/findingthesoul/thefibre/blob/main/docs/mcp-personal-access-plan.md',
  };
}

export function protectedResourceMetadata(origin: string, path: string = MCP_RESOURCE_PATH) {
  return {
    resource: `${origin}${path}`,
    authorization_servers: [origin],
    scopes_supported: [...MCP_SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'The Fibre',
  };
}

const cacheable = { 'cache-control': 'public, max-age=300' };

mcpDiscoveryRoutes.get('/.well-known/oauth-authorization-server', (c) =>
  c.json(authorizationServerMetadata(publicOrigin(c.req.raw.headers)), 200, cacheable),
);
// Both spellings of the resource document: at the root, and path-suffixed
// (RFC 9728 §3), which is what a client derives from the resource URL.
// On an mcp.* host both name the root resource — one identity per host.
const resourceDoc = (c: { req: { raw: Request } }) => {
  const { origin, path } = mcpResource(c.req.raw.headers);
  return protectedResourceMetadata(origin, path);
};
mcpDiscoveryRoutes.get('/.well-known/oauth-protected-resource', (c) => c.json(resourceDoc(c), 200, cacheable));
mcpDiscoveryRoutes.get(`/.well-known/oauth-protected-resource${MCP_RESOURCE_PATH}`, (c) => c.json(resourceDoc(c), 200, cacheable));
// RFC 9728 path-insertion for a per-workspace address: a client connected to
// https://mcp.<apex>/<slug> is pointed here by the 401 challenge and reads a
// `resource` that names that slug. Inert off the mcp host.
mcpDiscoveryRoutes.get('/.well-known/oauth-protected-resource/:slug', (c, next) => {
  const slug = c.req.param('slug');
  if (!isMcpHost(c.req.raw.headers) || !isWorkspaceSlug(slug)) return next();
  const { origin, path } = mcpResource(c.req.raw.headers, slug);
  return c.json(protectedResourceMetadata(origin, path), 200, cacheable);
});
