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
export function redirectUriAcceptable(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.protocol === 'https:') return true;
    if (u.protocol === 'http:') return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
    return false;
  } catch {
    return false;
  }
}
