// Server-to-server credentials for apps — docs/brief-external-apps.md §2 + §3.
//
// The problem this solves: before app_key, an external app authenticated with
// a *user-scoped* Supabase JWT pulled from a signed-in browser session. That
// ruled out background sync, and — the serious half — handed a third-party app
// the user's full platform authority in every app, whatever its manifest asked
// for. An app key carries the APP's authority in ONE workspace, bounded by
// scopes the API checks on every request.
//
// The plaintext token exists exactly once, in the response to the mint call.
// We store sha256(token) and a display prefix; there is no way to recover it.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { adminClient } from '../db.js';

export const TOKEN_PREFIX = 'fibre_ak_';

// ---------------------------------------------------------------------------
// The scope vocabulary.
//
// Canonical here rather than in a CHECK constraint on purpose: adding a scope
// should be a deploy, not a schema migration against the platform database.
// That is the exact mistake the closed app slug allow-list made.
// ---------------------------------------------------------------------------
export const APP_SCOPES = [
  'read:persons',
  'write:persons',
  'read:organisations',
  'write:organisations',
  'read:activities',
  'write:activities',
  'write:curator_data',
] as const;

export type AppScope = (typeof APP_SCOPES)[number];

export function isAppScope(s: string): s is AppScope {
  return (APP_SCOPES as readonly string[]).includes(s);
}

/** Split a requested scope list into the ones we recognise and the ones we don't. */
export function partitionScopes(requested: readonly string[]): {
  valid: AppScope[];
  unknown: string[];
} {
  const valid: AppScope[] = [];
  const unknown: string[] = [];
  for (const s of requested) {
    if (isAppScope(s)) valid.push(s);
    else unknown.push(s);
  }
  return { valid: [...new Set(valid)], unknown };
}

// ---------------------------------------------------------------------------
// Minting + hashing
// ---------------------------------------------------------------------------

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** 256 bits of entropy, base64url, behind a recognisable prefix. */
export function generateToken(): { token: string; prefix: string; hash: string } {
  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
  return {
    token,
    // Enough to tell two keys apart in a list, far too little to guess one.
    prefix: token.slice(0, TOKEN_PREFIX.length + 6),
    hash: hashToken(token),
  };
}

export function looksLikeAppKey(bearer: string): boolean {
  return bearer.startsWith(TOKEN_PREFIX);
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export type ResolvedAppKey = {
  keyId: string;
  appId: string;
  appSlug: string;
  workspaceId: string;
  scopes: AppScope[];
};

/**
 * Resolve a presented token to (app, workspace, scopes), or null.
 *
 * Returns null for: unknown token, revoked key, app not `approved`, or the app
 * not activated on that workspace. Suspending an app or deactivating it on a
 * workspace therefore kills its keys immediately — no separate revocation step.
 */
export async function resolveAppKey(token: string): Promise<ResolvedAppKey | null> {
  if (!looksLikeAppKey(token)) return null;

  const hash = hashToken(token);
  const { data: key, error } = await adminClient
    .from('app_key')
    .select('id, app_id, workspace_id, token_hash, scopes, revoked_at, app:app_id (slug, status)')
    .eq('token_hash', hash)
    .maybeSingle();

  if (error) {
    console.error('[app-keys] lookup failed', error);
    return null;
  }
  if (!key || key.revoked_at) return null;

  // The lookup was by an indexed equality on the hash, so this is belt-and-
  // braces rather than the real defence — but comparing the digests in
  // constant time costs nothing.
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(String(key.token_hash), 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const app = Array.isArray(key.app) ? key.app[0] : key.app;
  if (!app || app.status !== 'approved') return null;

  // The app must still be activated on this workspace.
  const { data: activation } = await adminClient
    .from('workspace_app')
    .select('id')
    .eq('workspace_id', key.workspace_id)
    .eq('app_id', key.app_id)
    .is('deactivated_at', null)
    .maybeSingle();
  if (!activation) return null;

  return {
    keyId: key.id as string,
    appId: key.app_id as string,
    appSlug: app.slug as string,
    workspaceId: key.workspace_id as string,
    scopes: ((key.scopes as string[] | null) ?? []).filter(isAppScope),
  };
}

// last_used_at is a liveness signal for the admin UI ("this key is still in
// use, don't revoke it"), not an audit log. Writing it on every request would
// be a row update per call, so throttle to once a minute per key and never
// let a failure affect the request.
const lastTouch = new Map<string, number>();
const TOUCH_INTERVAL_MS = 60_000;

export function touchAppKey(keyId: string): void {
  const now = Date.now();
  const prev = lastTouch.get(keyId) ?? 0;
  if (now - prev < TOUCH_INTERVAL_MS) return;
  lastTouch.set(keyId, now);
  void adminClient
    .from('app_key')
    .update({ last_used_at: new Date(now).toISOString() })
    .eq('id', keyId)
    .then(({ error }) => {
      if (error) console.error('[app-keys] touch failed', error);
    });
}
