// Teams (Microsoft Graph) access tokens, per user. The ONE place that trades a
// stored refresh token for a usable access token. Same two reasons as
// lib/zoom/host.ts, and the same shape:
//   - Microsoft rotates the refresh token on every refresh. The new one must
//     be persisted or the next call fails. We write it back immediately.
//   - A booking can touch Graph several times in a second. Without a cache
//     each hop rotates the token again and concurrent rotations race. So:
//     cache the access token until 60s before expiry and coalesce in-flight
//     refreshes per user.
//
// One difference from Zoom: a failed refresh is classified on Microsoft's
// `error` CODE (TeamsTokenError.code), not on message text. Only the codes
// that mean "this refresh token will never work again without the person"
// clear the connection. `invalid_client` (OUR secret expired) and 5xx/network
// errors must NOT: they are ours to fix, and wiping every user's connection
// because a client secret lapsed would turn one rotation chore into a
// reconnect for everybody.

import { refreshAccessToken, TeamsTokenError } from './client.js';
import { saveTeamsConnection, userTeamsToken } from '../connections.js';

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();
const inflight = new Map<string, Promise<string | null>>();

/** Codes after which only the person can fix it: revoked, expired, password
 *  changed, conditional access now demands a fresh sign-in. */
const REVOKED = new Set(['invalid_grant', 'interaction_required']);

async function refreshAndStore(userId: string): Promise<string | null> {
  const stored = await userTeamsToken(userId);
  if (!stored) return null;

  let tokens;
  try {
    tokens = await refreshAccessToken(stored);
  } catch (err) {
    if (err instanceof TeamsTokenError && REVOKED.has(err.code)) {
      await saveTeamsConnection(userId, null).catch(() => undefined);
      tokenCache.delete(userId);
      return null;
    }
    throw err;
  }

  // Persisting the rotated token is the whole point of this file; a failed
  // write is logged loudly (the old token may already be dead) but does not
  // stop the access token we do hold from serving this one call.
  const saved = await saveTeamsConnection(userId, tokens.refreshToken).catch((e) => ({
    error: e instanceof Error ? e.message : String(e),
  }));
  if (saved.error) console.error('[teams/host] could not persist rotated refresh token', saved.error);
  tokenCache.set(userId, {
    accessToken: tokens.accessToken,
    expiresAt: Date.now() + (tokens.expiresInSeconds - 60) * 1000,
  });
  return tokens.accessToken;
}

export async function teamsAccessTokenForUser(
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;
  const cached = tokenCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.accessToken;

  const pending = inflight.get(userId);
  if (pending) return pending;
  const p = refreshAndStore(userId).finally(() => inflight.delete(userId));
  inflight.set(userId, p);
  return p;
}

/** Called on disconnect so a wiped refresh token can't keep working from cache. */
export function clearTeamsTokenCache(userId: string): void {
  tokenCache.delete(userId);
}
