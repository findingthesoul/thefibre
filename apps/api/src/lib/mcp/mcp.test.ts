// The sign-in half of MCP personal access, without a database or Supabase:
// PKCE, the scope narrowing, the discovery documents, and our own access /
// refresh tokens. The grant table is stubbed; the live token dance runs in
// verify-mcp-personal.mjs against staging (plan §4, P3).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rows = new Map<string, Record<string, unknown>>();
function table(name: string) {
  const filters: Record<string, unknown> = {};
  let patch: Record<string, unknown> | null = null;
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => {
      filters[k] = v;
      return q;
    },
    is: (k: string, v: unknown) => {
      filters[`${k} is`] = v;
      return q;
    },
    order: () => q,
    update: (p: Record<string, unknown>) => {
      patch = p;
      return q;
    },
    insert: (p: Record<string, unknown>) => {
      const id = 'g-' + (rows.size + 1);
      rows.set(id, { id, revoked_at: null, activated_at: null, refresh_token_hash: null, refresh_token_expires_at: null, last_used_at: null, created_at: new Date().toISOString(), ...p });
      filters.id = id;
      return q;
    },
    single: async () => ({ data: rows.get(String(filters.id)) ?? null, error: null }),
    maybeSingle: async () => {
      if (name !== 'mcp_grant') return { data: null, error: null };
      const found = [...rows.values()].find((r) => Object.entries(filters).every(([k, v]) => (k.endsWith(' is') ? r[k.slice(0, -3)] === v : r[k] === v)));
      if (patch && found) Object.assign(found, patch);
      return { data: found ?? null, error: null };
    },
    then: (resolve: (v: { data: unknown[]; error: null }) => void) => {
      const found = [...rows.values()].filter((r) => Object.entries(filters).every(([k, v]) => (k.endsWith(' is') ? r[k.slice(0, -3)] === v : r[k] === v)));
      if (patch) for (const r of found) Object.assign(r, patch);
      resolve({ data: found, error: null });
    },
  };
  return q;
}
vi.mock('../../db.js', () => ({ adminClient: { from: (n: string) => table(n) } }));

const { pkceChallengeOf, pkceMatches, redirectUriAcceptable } = await import('./pkce.js');
const { authorizationServerMetadata, protectedResourceMetadata, publicOrigin, MCP_SCOPES } = await import('../../routes/mcp-discovery.js');
const { signAccessToken, grantFromAccessToken, issueRefreshToken, grantFromRefreshToken, revokeGrant, resetGrantCachesForTests } = await import('./grants.js');

beforeEach(() => {
  process.env.SSO_INTERNAL_SECRET = 'an-internal-secret-long-enough-for-tests-0000';
  process.env.ASSISTANT_KEY_SECRET = 'a-dedicated-secret-long-enough-for-tests-1111';
  rows.clear();
  resetGrantCachesForTests();
});
afterEach(() => {
  delete process.env.API_PUBLIC_URL;
});

describe('PKCE', () => {
  it('accepts the verifier whose S256 hash is the challenge, and nothing else', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = pkceChallengeOf(verifier);
    expect(pkceMatches(verifier, challenge, 'S256')).toBe(true);
    expect(pkceMatches(verifier + 'x', challenge, 'S256')).toBe(false);
    expect(pkceMatches(verifier, challenge, 'plain')).toBe(false);
    expect(pkceMatches(undefined, challenge, 'S256')).toBe(false);
    expect(pkceMatches('short', pkceChallengeOf('short'), 'S256')).toBe(false);
  });

  it('lets a self-registered client redirect to https anywhere, http only on the loopback', () => {
    expect(redirectUriAcceptable('https://claude.ai/api/mcp/auth_callback')).toBe(true);
    expect(redirectUriAcceptable('http://localhost:6274/oauth/callback')).toBe(true);
    expect(redirectUriAcceptable('http://127.0.0.1:33418/callback')).toBe(true);
    expect(redirectUriAcceptable('http://evil.example/callback')).toBe(false);
    expect(redirectUriAcceptable('javascript:alert(1)')).toBe(false);
    expect(redirectUriAcceptable('not a url')).toBe(false);
  });
});

describe('discovery', () => {
  it('derives the public origin from the forwarded host, https unless local', () => {
    expect(publicOrigin(new Headers({ host: 'thefibre-api-staging.fly.dev' }))).toBe('https://thefibre-api-staging.fly.dev');
    expect(publicOrigin(new Headers({ host: 'localhost:8080' }))).toBe('http://localhost:8080');
    process.env.API_PUBLIC_URL = 'https://api.thefibre.app/';
    expect(publicOrigin(new Headers({ host: 'whatever' }))).toBe('https://api.thefibre.app');
  });

  it('points a client at our endpoints and only S256 + code + refresh', () => {
    const as = authorizationServerMetadata('https://x.test');
    expect(as.authorization_endpoint).toBe('https://x.test/api/v1/oauth/authorize');
    expect(as.registration_endpoint).toBe('https://x.test/api/v1/oauth/register');
    expect(as.code_challenge_methods_supported).toEqual(['S256']);
    expect(as.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
    const pr = protectedResourceMetadata('https://x.test');
    expect(pr.resource).toBe('https://x.test/api/v1/mcp');
    expect(pr.authorization_servers).toEqual(['https://x.test']);
    expect(pr.scopes_supported).toEqual([...MCP_SCOPES]);
  });

  it('scopes are the reads plus the one write, and a client that names nothing gets reads only', async () => {
    expect([...MCP_SCOPES]).toEqual(['connections:read', 'thread:read', 'thread:write', 'models:read', 'models:write']);
    const { narrowScopes } = await import('../../routes/oauth-provider.js');
    // Found by review before the release (thefibre-83, 2026-09-25): the old
    // default was "every scope", which would have handed thread:write to any
    // client that authorised without naming scopes, with no consent text.
    expect(narrowScopes(undefined)).toEqual(['connections:read', 'thread:read', 'models:read']);
    expect(narrowScopes('')).toEqual(['connections:read', 'thread:read', 'models:read']);
    expect(narrowScopes('thread:write')).toEqual(['thread:write']);
    expect(narrowScopes('connections:write thread:read')).toEqual(['thread:read']);
  });
});

describe('our tokens', () => {
  const grant = {
    id: 'g-1',
    user_id: 'u-1',
    workspace_id: 'ws-1',
    client_id: 'mcp_abc',
    client_name: 'Claude',
    scopes: ['connections:read' as const],
    session_refresh_ciphertext: 'x',
    refresh_token_hash: null,
    refresh_token_expires_at: null,
    created_at: new Date().toISOString(),
    activated_at: null,
    last_used_at: null,
    revoked_at: null,
  };

  it('an access token names the grant and is bound to this resource', async () => {
    rows.set('g-1', { ...grant });
    const token = await signAccessToken(grant, 'https://x.test/api/v1/mcp');
    const back = await grantFromAccessToken(token, 'https://x.test/api/v1/mcp');
    expect(back?.id).toBe('g-1');
    // Another server's URL as audience → not ours.
    expect(await grantFromAccessToken(token, 'https://other.test/api/v1/mcp')).toBeNull();
    // A revoked grant fails closed even with a live token.
    rows.get('g-1')!.revoked_at = new Date().toISOString();
    expect(await grantFromAccessToken(token, 'https://x.test/api/v1/mcp')).toBeNull();
  });

  it('a Supabase JWT or an app key is not an MCP access token', async () => {
    expect(await grantFromAccessToken('fibre_ak_not_a_jwt', 'https://x.test/api/v1/mcp')).toBeNull();
    expect(await grantFromAccessToken('eyJhbGciOiJIUzI1NiJ9.e30.bad', 'https://x.test/api/v1/mcp')).toBeNull();
  });

  it('a refresh token is returned once, stored as a hash, rotated on use, and dead once revoked', async () => {
    rows.set('g-1', { ...grant });
    const rt1 = await issueRefreshToken(grant);
    expect(rt1.startsWith('fibre_rt_')).toBe(true);
    const stored = rows.get('g-1')!;
    expect(stored.refresh_token_hash).not.toContain(rt1);
    expect(stored.activated_at).toBeTruthy();

    const found = await grantFromRefreshToken(rt1);
    expect(found?.id).toBe('g-1');
    const rt2 = await issueRefreshToken(found!);
    expect(rt2).not.toBe(rt1);
    expect(await grantFromRefreshToken(rt1)).toBeNull();
    expect((await grantFromRefreshToken(rt2))?.id).toBe('g-1');

    expect(await grantFromRefreshToken('fibre_rt_unknown')).toBeNull();
    expect(await grantFromRefreshToken('not-even-ours')).toBeNull();

    expect(await revokeGrant('g-1', 'someone-else')).toBe(false);
    expect(await revokeGrant('g-1', 'u-1')).toBe(true);
    expect(await grantFromRefreshToken(rt2)).toBeNull();
  });

  it('an idle refresh token expires', async () => {
    rows.set('g-1', { ...grant });
    const rt = await issueRefreshToken(grant);
    rows.get('g-1')!.refresh_token_expires_at = new Date(Date.now() - 1000).toISOString();
    expect(await grantFromRefreshToken(rt)).toBeNull();
  });
});
