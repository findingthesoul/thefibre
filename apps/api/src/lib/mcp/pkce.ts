// PKCE (RFC 7636), S256 only. A public MCP client proves at the token
// endpoint that it is the same party that started the authorization: the
// verifier it sends must hash to the challenge it sent at /authorize.

import { createHash, timingSafeEqual } from 'node:crypto';

const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;

export function pkceChallengeOf(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

export function pkceMatches(verifier: string | undefined, challenge: string | null | undefined, method: string | null | undefined): boolean {
  if (!verifier || !challenge || method !== 'S256' || !VERIFIER_RE.test(verifier)) return false;
  const a = Buffer.from(pkceChallengeOf(verifier));
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A redirect URI a self-registered client may use: https anywhere, http only on the loopback. */
/**
 * May a self-registered client redirect here?
 *
 * https anywhere, http only on the loopback — and, since 2026-09-26, a
 * PRIVATE-USE SCHEME, which is how a desktop app gets the answer back.
 *
 * Claude Desktop could not connect at all: `POST /oauth/register` answered
 * 400 `invalid_redirect_uri` and the app showed "Couldn't register with The
 * Fibre's sign-in service", which names neither the field nor the reason.
 * Reproduced by registering `claude://mcp/callback` by hand and getting the
 * same 400. Web claude.ai was unaffected — its callback is an https URL —
 * so the feature looked fine to anyone testing in a browser and was broken
 * for the client most people actually run.
 *
 * RFC 8252 §7.1 endorses private-use schemes for native apps precisely
 * because they have no https origin to own. Refusing them is stricter than
 * the spec in the one place it costs a working integration.
 *
 * What is still refused, and why the list is short:
 *   - a scheme with no dot and no colon-slash form that could be confused for
 *     a fetchable URL — `javascript:`, `data:`, `file:`, `vbscript:` are named
 *     rather than inferred, because each is a way to turn a redirect into
 *     execution or disclosure;
 *   - anything the URL parser rejects outright.
 *
 * The redirect is matched EXACTLY at authorise time against what was
 * registered (see /authorize, which renders an error rather than bouncing to
 * an unregistered URI), so widening what may be REGISTERED does not widen
 * where an existing client may be sent.
 */
const DANGEROUS_SCHEMES = new Set(['javascript:', 'data:', 'file:', 'vbscript:', 'blob:', 'about:']);

export function redirectUriAcceptable(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.protocol === 'https:') return true;
    if (u.protocol === 'http:') return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
    if (DANGEROUS_SCHEMES.has(u.protocol)) return false;
    // A private-use scheme: claude://…, com.example.app://…
    return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol);
  } catch {
    return false;
  }
}
