import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  verifyZoomSignature,
  zoomUrlValidationResponse,
  parseZoomDeauthorization,
  ZOOM_MAX_AGE_SECONDS,
} from './webhook.js';

const SECRET = 'test-secret-token';
const NOW = 1_800_000_000; // seconds

// Built independently of the module, from Zoom's documented recipe, so a bug
// in webhook.ts cannot make its own test agree with it.
function signLikeZoom(body: string, timestamp: string, secret = SECRET): string {
  return `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`;
}

describe('zoomUrlValidationResponse', () => {
  it('echoes the plainToken and returns its hex HMAC-SHA256 keyed by the secret', () => {
    const out = zoomUrlValidationResponse(SECRET, 'qgg8vlvZRS6UYooatFL8Aw');
    expect(out.plainToken).toBe('qgg8vlvZRS6UYooatFL8Aw');
    expect(out.encryptedToken).toBe(
      createHmac('sha256', SECRET).update('qgg8vlvZRS6UYooatFL8Aw').digest('hex'),
    );
    expect(out.encryptedToken).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('verifyZoomSignature', () => {
  const body = '{"event":"app_deauthorized","payload":{"user_id":"abc"}}';
  const ts = String(NOW);

  it('accepts a request signed the way Zoom signs it (the success twin)', () => {
    expect(
      verifyZoomSignature({ secret: SECRET, rawBody: body, signature: signLikeZoom(body, ts), timestamp: ts, nowSeconds: NOW }),
    ).toEqual({ ok: true });
  });

  it('refuses a signature made with the wrong secret', () => {
    expect(
      verifyZoomSignature({
        secret: SECRET,
        rawBody: body,
        signature: signLikeZoom(body, ts, 'someone-else'),
        timestamp: ts,
        nowSeconds: NOW,
      }),
    ).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('refuses a body that differs by one character — it must be the RAW body', () => {
    const reserialised = '{"event": "app_deauthorized","payload":{"user_id":"abc"}}';
    expect(
      verifyZoomSignature({
        secret: SECRET,
        rawBody: reserialised,
        signature: signLikeZoom(body, ts),
        timestamp: ts,
        nowSeconds: NOW,
      }),
    ).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('refuses a replay older than the window', () => {
    const old = String(NOW - ZOOM_MAX_AGE_SECONDS - 1);
    expect(
      verifyZoomSignature({ secret: SECRET, rawBody: body, signature: signLikeZoom(body, old), timestamp: old, nowSeconds: NOW }),
    ).toEqual({ ok: false, reason: 'stale' });
  });

  it('accepts a timestamp sent in milliseconds, still hashing the header as sent', () => {
    const ms = String(NOW * 1000);
    expect(
      verifyZoomSignature({ secret: SECRET, rawBody: body, signature: signLikeZoom(body, ms), timestamp: ms, nowSeconds: NOW }),
    ).toEqual({ ok: true });
  });

  it('refuses when a header is missing', () => {
    expect(verifyZoomSignature({ secret: SECRET, rawBody: body, signature: null, timestamp: ts, nowSeconds: NOW })).toEqual({
      ok: false,
      reason: 'missing',
    });
    expect(
      verifyZoomSignature({ secret: SECRET, rawBody: body, signature: signLikeZoom(body, ts), timestamp: undefined, nowSeconds: NOW }),
    ).toEqual({ ok: false, reason: 'missing' });
  });

  it('refuses a signature of a different length without throwing', () => {
    expect(
      verifyZoomSignature({ secret: SECRET, rawBody: body, signature: 'v0=short', timestamp: ts, nowSeconds: NOW }),
    ).toEqual({ ok: false, reason: 'mismatch' });
  });
});

describe('parseZoomDeauthorization', () => {
  it('reads the user, account and client from app_deauthorized', () => {
    expect(
      parseZoomDeauthorization({
        event: 'app_deauthorized',
        payload: { user_id: 'u1', account_id: 'a1', client_id: 'c1', deauthorization_time: 'x', signature: 's' },
      }),
    ).toEqual({ userId: 'u1', accountId: 'a1', clientId: 'c1' });
  });

  it('ignores every other event', () => {
    expect(parseZoomDeauthorization({ event: 'meeting.started', payload: { user_id: 'u1' } })).toBeNull();
    expect(parseZoomDeauthorization({ event: 'endpoint.url_validation', payload: { plainToken: 'x' } })).toBeNull();
  });

  it('refuses a deauthorization without a user id rather than deleting at random', () => {
    expect(parseZoomDeauthorization({ event: 'app_deauthorized', payload: {} })).toBeNull();
    expect(parseZoomDeauthorization(null)).toBeNull();
  });
});
