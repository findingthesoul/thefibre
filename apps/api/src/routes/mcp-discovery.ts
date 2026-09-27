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

/** Origin, endpoint path and resource identifier for THIS request's host. */
export function mcpResource(headers: Headers): { origin: string; path: string; resource: string } {
  const origin = publicOrigin(headers);
  const path = isMcpHost(headers) ? '' : MCP_RESOURCE_PATH;
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
