// The `state` round-trip. Two properties matter and they are different:
// it must be unforgeable (it is the ONLY authentication the callback has,
// because the admin arrives from Stripe's domain with no session), and it
// must carry the app the admin started from — the 2026-09-24 bug where a
// Thread admin was returned to the Membership app on the PRODUCTION stack.
import { createHmac } from 'node:crypto';
import { describe, expect, it, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.SSO_INTERNAL_SECRET = 'test-secret-for-state-signing';
});

const { signState, verifyState } = await import('./connect.js');

describe('connect state', () => {
  it('round-trips the workspace and the app it was started from', () => {
    const state = signState('ws-123', 'the-thread');
    expect(verifyState(state)).toEqual({ workspaceId: 'ws-123', appId: 'the-thread' });
  });

  it('rejects a tampered body', () => {
    const [, mac] = signState('ws-123', 'the-thread').split('.');
    const forged = `${Buffer.from('ws-evil.the-thread.' + (Date.now() + 60_000)).toString('base64url')}.${mac}`;
    expect(verifyState(forged)).toBeNull();
  });

  it('rejects an expired state', () => {
    expect(verifyState(signState('ws-123', 'the-thread', -1))).toBeNull();
  });

  it('rejects junk without throwing', () => {
    for (const junk of ['', 'x', 'a.b', '!!!.???']) {
      expect(verifyState(junk)).toBeNull();
    }
  });

  it('still accepts a two-part state signed by the previous build', () => {
    // An admin mid-flow across the deploy that added the app id. They have no
    // app to return to, which the caller handles; they must not be stranded.
    const body = `ws-123.${Date.now() + 60_000}`;
    const mac = createHmac('sha256', process.env.SSO_INTERNAL_SECRET!).update(body).digest('base64url');
    const legacy = `${Buffer.from(body).toString('base64url')}.${mac}`;
    expect(verifyState(legacy)).toEqual({ workspaceId: 'ws-123', appId: null });
  });
});
