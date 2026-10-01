// MCP grants — docs/mcp-personal-access-plan.md §3.1.
//
// A grant is one person's connection of one MCP client to one workspace. What
// makes it work is the credential it holds: a DEDICATED Supabase session for
// that person, minted at consent and never shared with a browser tab, so
// refreshing it cannot sign anyone out. On every MCP call the grant becomes a
// fresh user JWT; the tools call this API's own routes with it, and every
// policy applies as it does to a click.
//
// Three tokens live here, and it matters which is which:
//   - the SESSION refresh token (Supabase's): encrypted at rest, never leaves
//     this process, rotated by Supabase on every refresh — we store the new one.
//   - the OAuth REFRESH token (ours): handed to the client once, sha256 stored,
//     rotated on every use, 90 idle days then gone (plan §6.3).
//   - the OAuth ACCESS token (ours): a one-hour HS256 JWT carrying the grant
//     id; stateless, verified on every call to /api/v1/mcp.

import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { adminClient } from '../../db.js';
import { decryptSecret, encryptSecret } from '../secret-box.js';
import type { McpScope } from '../../routes/mcp-discovery.js';

export const ACCESS_TOKEN_TTL_S = 3600;
export const REFRESH_TOKEN_IDLE_DAYS = 90;
const REFRESH_PREFIX = 'fibre_rt_';
const ISSUER = 'thefibre-oauth';
const TYP = 'mcp';

export interface Grant {
  id: string;
  user_id: string;
  workspace_id: string;
  client_id: string;
  client_name: string;
  scopes: McpScope[];
  session_refresh_ciphertext: string;
  refresh_token_hash: string | null;
  refresh_token_expires_at: string | null;
  created_at: string;
  activated_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  /**
   * The canonical connector address this grant was made for, e.g.
   * `https://mcp.thefibre.app/festival-of-trust-7va1` — the access token's
   * audience. Null for a grant made on a plain address, whose audience is
   * derived from the request host as it always was.
   */
  resource: string | null;
  /**
   * The dedicated Supabase session's id. The access-token hook pins a session
   * listed here to THIS grant's workspace, whatever the person has active in
   * a browser — so one Claude can hold several workspaces (2026-10-01). Null on
   * grants made before that; filled in on their next refresh.
   */
  session_id: string | null;
}

const GRANT_SELECT =
  'id, user_id, workspace_id, client_id, client_name, scopes, session_refresh_ciphertext, refresh_token_hash, refresh_token_expires_at, created_at, activated_at, last_used_at, revoked_at, resource, session_id';

function sha256hex(v: string): string {
  return createHash('sha256').update(v, 'utf8').digest('hex');
}

function anonAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

function internalSecret(): Uint8Array {
  const s = process.env.SSO_INTERNAL_SECRET;
  if (!s) throw new Error('SSO_INTERNAL_SECRET is not set');
  return new TextEncoder().encode(s);
}

// ---------------------------------------------------------------------------
// Creating a grant: a dedicated session for the person.
// ---------------------------------------------------------------------------

/**
 * Mint a Supabase session for `email` that no browser holds: generateLink
 * (no email sent) → verifyOtp. Same two calls the SSO hop uses
 * (routes/sso.ts), with the same known trade-off: it invalidates an email OTP
 * the person may be mid-typing elsewhere at that exact moment.
 */
async function mintDedicatedSession(email: string): Promise<{ access_token: string; refresh_token: string; expires_at: number }> {
  const { data: link, error } = await adminClient.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link?.properties?.hashed_token;
  if (error || !tokenHash) throw new Error(`generateLink failed: ${error?.message ?? 'no token'}`);
  const { data, error: vErr } = await anonAuthClient().auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
  if (vErr || !data.session) throw new Error(`verifyOtp failed: ${vErr?.message ?? 'no session'}`);
  const s = data.session;
  return { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + 3600 };
}

export async function createGrant(input: {
  userId: string;
  email: string;
  workspaceId: string;
  clientId: string;
  clientName: string;
  scopes: McpScope[];
  /** Canonical connector address (per-workspace), or null for a plain one. */
  resource?: string | null;
}): Promise<Grant> {
  const session = await mintDedicatedSession(input.email);
  // The session's id is what lets the access-token hook pin THIS session to
  // the grant's workspace, whatever the person has active in a browser.
  const sid = claimsOf(session.access_token).session_id;
  const { data, error } = await adminClient
    .from('mcp_grant')
    .insert({
      user_id: input.userId,
      workspace_id: input.workspaceId,
      client_id: input.clientId,
      client_name: input.clientName,
      scopes: input.scopes,
      session_refresh_ciphertext: encryptSecret(session.refresh_token),
      resource: input.resource ?? null,
      session_id: typeof sid === 'string' ? sid : null,
    })
    .select(GRANT_SELECT)
    .single();
  if (error || !data) throw new Error(`mcp_grant insert failed: ${error?.message}`);
  const grant = data as Grant;
  // The first token was minted BEFORE the grant row existed, so the hook could
  // not pin it: it carries the person's active workspace. If that is not this
  // grant's, do not cache it — the first call refreshes and gets a pinned one.
  const firstWs = claimsOf(session.access_token).workspace_id;
  if (!firstWs || firstWs === grant.workspace_id) {
    sessionCache.set(grant.id, { jwt: session.access_token, exp: session.expires_at * 1000 });
  }
  return grant;
}

export async function loadGrant(id: string): Promise<Grant | null> {
  const { data } = await adminClient.from('mcp_grant').select(GRANT_SELECT).eq('id', id).maybeSingle();
  return (data as Grant | null) ?? null;
}

// ---------------------------------------------------------------------------
// The person's JWT for a call.
// ---------------------------------------------------------------------------

const sessionCache = new Map<string, { jwt: string; exp: number }>();
const refreshing = new Map<string, Promise<string>>();

export class GrantError extends Error {
  constructor(
    readonly code: 'revoked' | 'session_lost' | 'workspace_switched' | 'not_member',
    message: string,
  ) {
    super(message);
  }
}

function claimsOf(jwt: string): Record<string, unknown> {
  try {
    const [, payload] = jwt.split('.');
    return JSON.parse(Buffer.from(payload ?? '', 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * A fresh Supabase JWT for the grant's person. Cached until a minute before
 * expiry; refreshes are serialised per grant so two parallel tool calls
 * cannot race Supabase's refresh-token rotation.
 */
export async function sessionJwtFor(grant: Grant): Promise<string> {
  if (grant.revoked_at) throw new GrantError('revoked', 'this connection was disconnected');
  const hit = sessionCache.get(grant.id);
  if (hit && hit.exp - 60_000 > Date.now()) return hit.jwt;
  const inflight = refreshing.get(grant.id);
  if (inflight) return inflight;
  const p = refreshSession(grant).finally(() => refreshing.delete(grant.id));
  refreshing.set(grant.id, p);
  return p;
}

async function refreshSession(grant: Grant): Promise<string> {
  let refreshToken: string;
  try {
    refreshToken = decryptSecret(grant.session_refresh_ciphertext);
  } catch (e) {
    // ASSISTANT_KEY_SECRET rotated without a re-encrypt pass, or a corrupt row.
    console.error(`[mcp] grant ${grant.id}: stored session unreadable — ${e instanceof Error ? e.message : e}`);
    throw new GrantError('session_lost', 'this connection needs to be made again');
  }
  // One refresh round trip: Supabase rotates the refresh token (the old one is
  // dead in ~10 s), so the new one is stored before anything else is looked at.
  const refreshOnce = async (token: string) => {
    const { data, error } = await anonAuthClient().auth.refreshSession({ refresh_token: token });
    if (error || !data.session) {
      // Signed out everywhere, password changed, or the session was revoked on
      // the Supabase side. The grant is dead; say so and make it visible.
      // Logged with Supabase's reason: on 2026-09-27 a grant died 334 ms after
      // a good call and nothing said why. (A browser sign-out used to be one
      // cause — supabase-js signs out EVERY session by default, this one
      // included; the apps now sign out with scope 'local'.)
      console.warn(`[mcp] grant ${grant.id}: session refresh refused — ${error?.message ?? 'no session returned'}; revoking`);
      await adminClient.from('mcp_grant').update({ revoked_at: new Date().toISOString() }).eq('id', grant.id).is('revoked_at', null);
      throw new GrantError('session_lost', 'this connection has expired — connect again');
    }
    const next = data.session;
    await adminClient
      .from('mcp_grant')
      .update({ session_refresh_ciphertext: encryptSecret(next.refresh_token), last_used_at: new Date().toISOString() })
      .eq('id', grant.id);
    return next;
  };

  let s = await refreshOnce(refreshToken);
  let claims = claimsOf(s.access_token);

  // A grant made before 2026-10-01 has no session_id on record, so the hook
  // could not pin it and this token carries the person's ACTIVE workspace.
  // Record the id now; if the workspace came out wrong, one more refresh runs
  // the hook with the pin in place. Legacy grants heal themselves on first
  // use instead of failing with workspace_switched.
  if (!grant.session_id && typeof claims.session_id === 'string') {
    await adminClient.from('mcp_grant').update({ session_id: claims.session_id }).eq('id', grant.id);
    grant.session_id = claims.session_id;
    if (claims.workspace_id && claims.workspace_id !== grant.workspace_id) {
      s = await refreshOnce(s.refresh_token);
      claims = claimsOf(s.access_token);
    }
  }

  // The grant is for ONE workspace. With the session pinned in the hook this
  // always holds; it stays as the assertion that makes a hook regression loud
  // instead of a silent read from the wrong tenant (plan §3.1). Membership is
  // re-checked on every refresh as well.
  if (claims.workspace_id && claims.workspace_id !== grant.workspace_id) {
    throw new GrantError(
      'workspace_switched',
      'your active workspace in The Fibre is not the one this connection was made for — switch back, or connect again',
    );
  }
  const { data: member } = await adminClient
    .from('workspace_member')
    .select('user_id')
    .eq('user_id', grant.user_id)
    .eq('workspace_id', grant.workspace_id)
    .maybeSingle();
  if (!member) throw new GrantError('not_member', 'you are no longer a member of this workspace');

  const exp = (s.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000;
  sessionCache.set(grant.id, { jwt: s.access_token, exp });
  return s.access_token;
}

// ---------------------------------------------------------------------------
// Our tokens: access (JWT) and refresh (opaque, hashed).
// ---------------------------------------------------------------------------

export async function signAccessToken(grant: Grant, resource: string): Promise<string> {
  return new SignJWT({ typ: TYP, gid: grant.id, ws: grant.workspace_id, client_id: grant.client_id, scope: grant.scopes.join(' ') })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setSubject(grant.user_id)
    .setAudience(resource)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_S}s`)
    .sign(internalSecret());
}

/** The grant behind a bearer, or null. `resource` is what this endpoint is. */
export async function grantFromAccessToken(bearer: string, resource: string): Promise<Grant | null> {
  try {
    const { payload } = await jwtVerify(bearer, internalSecret(), { issuer: ISSUER, audience: resource });
    if (payload.typ !== TYP || typeof payload.gid !== 'string') return null;
    const grant = await loadGrant(payload.gid);
    if (!grant || grant.revoked_at) return null;
    return grant;
  } catch {
    return null;
  }
}

/** Issue (or rotate) the OAuth refresh token. Returned once; only its hash stays. */
export async function issueRefreshToken(grant: Grant): Promise<string> {
  const token = REFRESH_PREFIX + randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + REFRESH_TOKEN_IDLE_DAYS * 86_400_000).toISOString();
  const { error } = await adminClient
    .from('mcp_grant')
    .update({
      refresh_token_hash: sha256hex(token),
      refresh_token_expires_at: expires,
      activated_at: grant.activated_at ?? new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    })
    .eq('id', grant.id);
  if (error) throw new Error(`refresh token write failed: ${error.message}`);
  return token;
}

/** The live grant a refresh token belongs to, or null (unknown, expired, revoked). */
export async function grantFromRefreshToken(token: string): Promise<Grant | null> {
  if (!token.startsWith(REFRESH_PREFIX)) return null;
  const hash = sha256hex(token);
  const { data } = await adminClient.from('mcp_grant').select(GRANT_SELECT).eq('refresh_token_hash', hash).maybeSingle();
  const g = (data as Grant | null) ?? null;
  if (!g || g.revoked_at || !g.refresh_token_hash) return null;
  // Constant-time compare even though the lookup was by hash: belt and braces.
  const a = Buffer.from(hash);
  const b = Buffer.from(g.refresh_token_hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (g.refresh_token_expires_at && new Date(g.refresh_token_expires_at).getTime() < Date.now()) return null;
  return g;
}

export async function revokeGrant(id: string, userId?: string): Promise<boolean> {
  let q = adminClient.from('mcp_grant').update({ revoked_at: new Date().toISOString() }).eq('id', id).is('revoked_at', null);
  if (userId) q = q.eq('user_id', userId);
  const { data, error } = await q.select('id');
  sessionCache.delete(id);
  return !error && !!data && data.length > 0;
}

/** What Settings → Connections shows. Never the credential. */
export async function listGrants(userId: string): Promise<
  { id: string; client_name: string; client_id: string; workspace_id: string; scopes: string[]; created_at: string; last_used_at: string | null; active: boolean }[]
> {
  const { data } = await adminClient
    .from('mcp_grant')
    .select('id, client_name, client_id, workspace_id, scopes, created_at, last_used_at, activated_at, revoked_at')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    client_name: r.client_name as string,
    client_id: r.client_id as string,
    workspace_id: r.workspace_id as string,
    scopes: (r.scopes as string[]) ?? [],
    created_at: r.created_at as string,
    last_used_at: (r.last_used_at as string | null) ?? null,
    active: !!r.activated_at,
  }));
}

/** Test seam. */
export function resetGrantCachesForTests(): void {
  sessionCache.clear();
  refreshing.clear();
}
