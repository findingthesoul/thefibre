// Zoom's webhook contract, as pure functions (Zoom Marketplace filing prep,
// 2026-09-14).
//
// A Zoom app listed publicly on the Marketplace must receive Zoom's
// deauthorization notice and delete the user's data when it arrives. Zoom's
// review tests that. Two things stand between Zoom and that endpoint, and
// both are defined here so they can be tested without a network:
//
//   1. URL validation. When the endpoint is registered, and periodically
//      after, Zoom sends `endpoint.url_validation` with a `plainToken`. The
//      endpoint proves it holds the app's secret token by answering with the
//      same plainToken and its HMAC-SHA256, hex, keyed by that secret.
//
//   2. Signature. Every request carries `x-zm-signature` and
//      `x-zm-request-timestamp`. The signature is `v0=` + hex HMAC-SHA256,
//      keyed by the secret token, of the string `v0:{timestamp}:{raw body}`.
//      It must be computed over the RAW body — a re-serialised JSON object
//      differs by a space and never matches.
//
// Source: developers.zoom.us/docs/api/webhooks (verification, validation,
// three-second response window) and docs/api/marketplace/events
// (app_deauthorized payload). Read 2026-09-14.

import { createHmac, timingSafeEqual } from 'node:crypto';

/** How old a signed request may be before it is treated as a replay. */
export const ZOOM_MAX_AGE_SECONDS = 5 * 60;

function hmacHex(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message).digest('hex');
}

/** The answer to `endpoint.url_validation`. */
export function zoomUrlValidationResponse(
  secret: string,
  plainToken: string,
): { plainToken: string; encryptedToken: string } {
  return { plainToken, encryptedToken: hmacHex(secret, plainToken) };
}

export type SignatureCheck =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'stale' | 'mismatch' };

/**
 * Is this request really from Zoom, and recent?
 *
 * `timestamp` is the x-zm-request-timestamp header — seconds since the epoch,
 * as Zoom sends it. The comparison is constant-time: a byte-by-byte early
 * exit would tell an attacker how much of a forged signature was right.
 */
export function verifyZoomSignature(args: {
  secret: string;
  rawBody: string;
  signature: string | null | undefined;
  timestamp: string | null | undefined;
  nowSeconds?: number;
}): SignatureCheck {
  const { secret, rawBody, signature, timestamp } = args;
  if (!signature || !timestamp) return { ok: false, reason: 'missing' };

  const ts = Number(timestamp);
  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  // Zoom's docs do not state the header's unit. Accept seconds or
  // milliseconds for the freshness check rather than refuse every real
  // request over a guess; the signature itself hashes the header string
  // exactly as sent, so the unit never affects whether it matches.
  const tsSeconds = ts > 1e12 ? Math.floor(ts / 1000) : ts;
  if (!Number.isFinite(tsSeconds) || Math.abs(now - tsSeconds) > ZOOM_MAX_AGE_SECONDS) {
    return { ok: false, reason: 'stale' };
  }

  const expected = `v0=${hmacHex(secret, `v0:${timestamp}:${rawBody}`)}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'mismatch' };
  return { ok: true };
}

/** The fields of `app_deauthorized` this platform acts on. */
export type ZoomDeauthorization = {
  userId: string;
  accountId: string | null;
  clientId: string | null;
};

/** Pull the deauthorization out of a parsed event, or null if it is not one. */
export function parseZoomDeauthorization(event: unknown): ZoomDeauthorization | null {
  const e = event as { event?: unknown; payload?: Record<string, unknown> } | null;
  if (!e || e.event !== 'app_deauthorized' || !e.payload) return null;
  const userId = e.payload.user_id;
  if (typeof userId !== 'string' || !userId) return null;
  return {
    userId,
    accountId: typeof e.payload.account_id === 'string' ? e.payload.account_id : null,
    clientId: typeof e.payload.client_id === 'string' ? e.payload.client_id : null,
  };
}
