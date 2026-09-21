// The MCP endpoint — docs/mcp-personal-access-plan.md §3.3.
//
// A person's own assistant speaks Streamable HTTP to /api/v1/mcp with the
// access token our OAuth provider minted for its GRANT. Each request:
//   1. verify the bearer → the grant (lib/mcp/grants.ts);
//   2. turn the grant into a fresh Supabase JWT for the person;
//   3. build a server whose tools call THIS API's ordinary routes with that
//      JWT (packages/mcp person catalogue) and let the SDK's web-standard
//      transport answer the request.
// Stateless: a server per request, no session ids. A missing or bad token
// answers 401 with the WWW-Authenticate challenge that points the client at
// the discovery documents — that is how a client learns to sign in.

import { createRequire } from 'node:module';
import { Hono, type Context } from 'hono';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { PersonClient, buildPersonServer } from '@thefibre/mcp/person';
import { adminClient } from '../db.js';
import { GrantError, grantFromAccessToken, sessionJwtFor } from '../lib/mcp/grants.js';
import { clientIp, hit } from '../lib/rate-limit.js';
import { MCP_RESOURCE_PATH, publicOrigin } from './mcp-discovery.js';

export const mcpRoutes = new Hono();

// Per grant: a working assistant makes a handful of calls per question.
const CALLS_PER_WINDOW = 120;
const WINDOW_MS = 60_000;

const VERSION: string = (createRequire(import.meta.url)('../../package.json') as { version: string }).version;

function challenge(c: Context, origin: string, detail: string) {
  const safe = detail.replace(/["\\\r\n]/g, ' ');
  c.header(
    'WWW-Authenticate',
    `Bearer realm="thefibre", resource_metadata="${origin}/.well-known/oauth-protected-resource${MCP_RESOURCE_PATH}", error="invalid_token", error_description="${safe}"`,
  );
  return c.json({ error: 'invalid_token', error_description: detail }, 401);
}

async function workspaceName(id: string): Promise<string> {
  const { data } = await adminClient.from('workspace').select('name').eq('id', id).maybeSingle();
  return (data?.name as string | undefined) ?? 'your workspace';
}

const handler = async (c: Context) => {
  const origin = publicOrigin(c.req.raw.headers);
  const auth = c.req.header('authorization') ?? '';
  const m = /^Bearer\s+(\S+)$/i.exec(auth);
  if (!m) return challenge(c, origin, 'sign in to connect this assistant to The Fibre');

  const grant = await grantFromAccessToken(m[1]!, `${origin}${MCP_RESOURCE_PATH}`);
  if (!grant) return challenge(c, origin, 'the token is not valid for this server, or the connection was disconnected');

  const brake = hit(`mcp:${grant.id}`, CALLS_PER_WINDOW, WINDOW_MS);
  if (!brake.allowed) {
    c.header('Retry-After', String(brake.resetSeconds));
    return c.json({ error: 'rate limit exceeded' }, 429);
  }
  // The brake keys on the grant; the IP is logged only so abuse has a face.
  const ip = clientIp(c.req.raw.headers);

  let jwt: string;
  try {
    jwt = await sessionJwtFor(grant);
  } catch (e) {
    if (e instanceof GrantError) {
      console.log(`[mcp] grant=${grant.id} ${e.code} ip=${ip}`);
      return challenge(c, origin, e.message);
    }
    console.error('[mcp] session refresh failed', e);
    return c.json({ error: 'server_error' }, 500);
  }

  const client = new PersonClient({ apiUrl: `http://127.0.0.1:${process.env.API_PORT ?? 8080}`, jwt });
  const server = buildPersonServer({
    client,
    scopes: grant.scopes,
    who: { workspace: await workspaceName(grant.workspace_id), clientName: grant.client_name },
    version: VERSION,
  });
  // No sessionIdGenerator → stateless: no Mcp-Session-Id, a server per request.
  // enableJsonResponse → the reply is one JSON body, complete when
  // handleRequest resolves. Without it the SDK answers with an SSE stream it
  // is still writing when we return — and the close() below cut it off,
  // which is how the first live initialize came back as an empty body.
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  const started = Date.now();
  try {
    await server.connect(transport);
    const res = await transport.handleRequest(c.req.raw);
    console.log(`[mcp] grant=${grant.id} ws=${grant.workspace_id} ${c.req.method} ${res.status} ms=${Date.now() - started}`);
    return res;
  } finally {
    // Stateless: nothing to keep between requests.
    void transport.close().catch(() => {});
    void server.close().catch(() => {});
  }
};

mcpRoutes.post('/', handler);
mcpRoutes.get('/', handler);
mcpRoutes.delete('/', handler);
