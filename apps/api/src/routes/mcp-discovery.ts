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
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    revocation_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [...MCP_SCOPES],
    service_documentation: 'https://github.com/findingthesoul/thefibre/blob/main/docs/mcp-personal-access-plan.md',
  };
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}${MCP_RESOURCE_PATH}`,
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
mcpDiscoveryRoutes.get('/.well-known/oauth-protected-resource', (c) =>
  c.json(protectedResourceMetadata(publicOrigin(c.req.raw.headers)), 200, cacheable),
);
mcpDiscoveryRoutes.get(`/.well-known/oauth-protected-resource${MCP_RESOURCE_PATH}`, (c) =>
  c.json(protectedResourceMetadata(publicOrigin(c.req.raw.headers)), 200, cacheable),
);
