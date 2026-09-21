// The consent side of connecting an assistant — docs/mcp-personal-access-plan.md §3.2.
//
// These routes run under the ordinary user session (appContext, X-App-ID
// fibre-platform): a signed-in person, on The Fibre's /connect page, deciding
// whether the assistant that sent them here may act as them. Approving mints
// the grant (a dedicated Supabase session, lib/mcp/grants.ts) and the
// single-use code the assistant exchanges at /oauth/token. Denying sends the
// assistant an access_denied, and nothing is stored.
//
//   GET    /client?client_id=      who is asking — name, redirect host, scopes
//   POST   /consent                approve | deny → { redirect }
//   GET    /grants                 the person's connections (Settings → Connections)
//   DELETE /grants/:id             disconnect one

import { Hono } from 'hono';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { adminClient } from '../db.js';
import { createGrant, listGrants, revokeGrant } from '../lib/mcp/grants.js';
import { loadClient, narrowScopes, redirectUriAllowed } from './oauth-provider.js';
import type { McpScope } from './mcp-discovery.js';

export const mcpAuthRoutes = new Hono();

const CODE_TTL_MS = 60 * 1000;

/** What the consent page says a scope means. Plain words, one line each. */
export const SCOPE_WORDS: Record<McpScope, string> = {
  'connections:read': 'Read your Connections: who is waiting for you, your agenda, your landscape, your notes on a person.',
  'thread:read': 'Read your threads: titles, dates, status, templates, and how registration is going as counts.',
};

mcpAuthRoutes.get('/client', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user') return c.json({ error: 'user session required' }, 403);
  const clientId = c.req.query('client_id');
  if (!clientId) return c.json({ error: 'client_id required' }, 400);
  const client = await loadClient(clientId);
  if (!client || client.kind !== 'mcp') return c.json({ error: 'unknown client' }, 404);
  const scopes = narrowScopes(c.req.query('scope'));
  return c.json({
    client_id: client.client_id,
    name: client.name,
    client_uri: typeof client.metadata.client_uri === 'string' ? client.metadata.client_uri : null,
    logo_uri: typeof client.metadata.logo_uri === 'string' ? client.metadata.logo_uri : null,
    redirect_hosts: [...new Set(client.redirect_uris.map((u) => new URL(u).host))],
    scopes: scopes.map((s) => ({ scope: s, words: SCOPE_WORDS[s as McpScope] })),
  });
});

const ConsentBody = z.object({
  client_id: z.string().min(1).max(200),
  redirect_uri: z.string().url().max(2000),
  state: z.string().max(1000).optional(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal('S256'),
  scope: z.string().max(500).optional(),
  resource: z.string().max(2000).optional(),
  decision: z.enum(['approve', 'deny']),
});

mcpAuthRoutes.post('/consent', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user' || !ctx.userId) return c.json({ error: 'user session required' }, 403);
  const body = ConsentBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const b = body.data;

  const client = await loadClient(b.client_id);
  if (!client || client.kind !== 'mcp') return c.json({ error: 'unknown client' }, 404);
  // Never build a redirect to an address the client did not register.
  if (!redirectUriAllowed(client, b.redirect_uri)) return c.json({ error: 'redirect_uri not registered for this client' }, 400);

  const redirect = new URL(b.redirect_uri);
  if (b.state) redirect.searchParams.set('state', b.state);

  if (b.decision === 'deny') {
    redirect.searchParams.set('error', 'access_denied');
    return c.json({ redirect: redirect.toString() });
  }

  // The person's email, for the dedicated session. authUserId is the
  // auth.users id (the JWT sub); the grant itself is keyed on public.user.id.
  const { data: authUser, error: uErr } = await adminClient.auth.admin.getUserById(ctx.authUserId);
  const email = authUser?.user?.email;
  if (uErr || !email) return c.json({ error: 'could not resolve your account email' }, 500);

  const scopes = narrowScopes(b.scope) as McpScope[];
  let grant;
  try {
    grant = await createGrant({
      userId: ctx.userId,
      email,
      workspaceId: ctx.workspaceId,
      clientId: client.client_id,
      clientName: client.name,
      scopes,
    });
  } catch (e) {
    console.error('[mcp-auth] grant creation failed', e instanceof Error ? e.message : e);
    return c.json({ error: 'could not create the connection' }, 500);
  }

  const code = randomBytes(32).toString('base64url');
  const { error } = await adminClient.from('oauth_code').insert({
    code,
    client_id: client.client_id,
    member_email: email,
    redirect_uri: b.redirect_uri,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    grant_id: grant.id,
    code_challenge: b.code_challenge,
    code_challenge_method: 'S256',
    scope: scopes.join(' '),
    resource: b.resource ?? null,
  });
  if (error) {
    console.error('[mcp-auth] oauth_code insert failed', error);
    await revokeGrant(grant.id);
    return c.json({ error: 'could not mint code' }, 500);
  }
  console.log(`[mcp-auth] grant ${grant.id} created: user=${ctx.userId} ws=${ctx.workspaceId} client=${client.client_id} scopes=${scopes.join(',')}`);
  redirect.searchParams.set('code', code);
  return c.json({ redirect: redirect.toString() });
});

mcpAuthRoutes.get('/grants', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user' || !ctx.userId) return c.json({ error: 'user session required' }, 403);
  return c.json({ items: await listGrants(ctx.userId) });
});

mcpAuthRoutes.delete('/grants/:id', async (c) => {
  const ctx = c.get('ctx');
  if (ctx.auth !== 'user' || !ctx.userId) return c.json({ error: 'user session required' }, 403);
  const ok = await revokeGrant(c.req.param('id'), ctx.userId);
  if (!ok) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});
