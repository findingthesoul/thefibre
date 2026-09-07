// Zoom access tokens, per user. The ONE place that trades a stored refresh
// token for a usable access token.
//
// Two things this exists to get right (both learned in Suite):
//   - Zoom rotates the refresh token on every exchange. The new one must be
//     persisted or the next call 401s. We write it back immediately.
//   - A booking flow can touch Zoom several times in a second (create →
//     maybe roll back → email). Without a cache each hop rotates the token
//     again, and two concurrent rotations invalidate each other. So: cache
//     the access token until 60s before expiry, and coalesce in-flight
//     refreshes per user.

import { refreshAccessToken } from './client.js';
import { saveZoomConnection, userZoomToken } from '../connections.js';

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();
const inflight = new Map<string, Promise<string | null>>();

async function refreshAndStore(userId: string): Promise<string | null> {
  const stored = await userZoomToken(userId);
  if (!stored) return null;

  let tokens;
  try {
    tokens = await refreshAccessToken(stored);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // invalid_grant = Zoom revoked us, or we're behind a rotation we lost.
    // Clear it so the settings card says "Connect" instead of failing
    // silently on every booking from here on.
    if (/invalid_grant|invalid token/i.test(message)) {
      await saveZoomConnection(userId, null).catch(() => undefined);
      tokenCache.delete(userId);
      return null;
    }
    throw err;
  }

  await saveZoomConnection(userId, tokens.refreshToken).catch(() => undefined);
  tokenCache.set(userId, {
    accessToken: tokens.accessToken,
    expiresAt: Date.now() + (tokens.expiresInSeconds - 60) * 1000,
  });
  return tokens.accessToken;
}

export async function zoomAccessTokenForUser(userId: string | null | undefined): Promise<string | null> {
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
export function clearZoomTokenCache(userId: string): void {
  tokenCache.delete(userId);
}
