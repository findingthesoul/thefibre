// The `state` round-trip. Three properties matter and they are different:
// it must be unforgeable (it is the ONLY authentication the callback has,
// because the admin arrives from Stripe's domain with no session); it must
// carry the app the admin started from (the 2026-09-24 bug where a Thread
// admin was returned to the Membership app on the PRODUCTION stack); and it
// must carry the SCOPE, because one callback serves both the workspace and
// the personal account and the wrong branch writes the account onto the
// wrong owner.
import { createHmac } from 'node:crypto';
import { describe, expect, it, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.SSO_INTERNAL_SECRET = 'test-secret-for-state-signing';
});

const { signState, verifyState } = await import('./connect.js');

const sign = (body: string) => {
  const mac = createHmac('sha256', process.env.SSO_INTERNAL_SECRET!)
    .update(body)
    .digest('base64url');
  return `${Buffer.from(body).toString('base64url')}.${mac}`;
};

describe('connect state', () => {
  it('round-trips a workspace connection', () => {
    expect(verifyState(signState('workspace', 'ws-123', 'the-thread'))).toEqual({
      scope: 'workspace',
      subjectId: 'ws-123',
      appId: 'the-thread',
    });
  });

  it('round-trips a personal connection', () => {
    expect(verifyState(signState('personal', 'user-9', 'fibre-meet'))).toEqual({
      scope: 'personal',
      subjectId: 'user-9',
      appId: 'fibre-meet',
    });
  });

  it('keeps the two scopes apart', () => {
    // The failure this guards is silent and expensive: the callback would
    // write a connected account onto a workspace instead of a person.
    const personal = verifyState(signState('personal', 'x', 'the-thread'));
    const workspace = verifyState(signState('workspace', 'x', 'the-thread'));
    expect(personal?.scope).toBe('personal');
    expect(workspace?.scope).toBe('workspace');
  });

  it('rejects a tampered body', () => {
    const [, mac] = signState('workspace', 'ws-123', 'the-thread').split('.');
    const forged = `${Buffer.from(
      `workspace.ws-evil.the-thread.${Date.now() + 60_000}`,
    ).toString('base64url')}.${mac}`;
    expect(verifyState(forged)).toBeNull();
  });

  it('rejects an unknown scope even when correctly signed', () => {
    expect(verifyState(sign(`admin.ws-1.the-thread.${Date.now() + 60_000}`))).toBeNull();
  });

  it('rejects an expired state', () => {
    expect(verifyState(signState('workspace', 'ws-123', 'the-thread', -1))).toBeNull();
  });

  it('rejects junk without throwing', () => {
    for (const junk of ['', 'x', 'a.b', '!!!.???']) {
      expect(verifyState(junk)).toBeNull();
    }
  });

  it('still reads the two shapes earlier builds signed', () => {
    // An admin standing in Stripe's approval screen when the deploy lands.
    // Both older shapes predate the personal scope, so both are workspace.
    const three = sign(`ws-123.the-thread.${Date.now() + 60_000}`); // v1.27.6
    expect(verifyState(three)).toEqual({
      scope: 'workspace',
      subjectId: 'ws-123',
      appId: 'the-thread',
    });
    const two = sign(`ws-123.${Date.now() + 60_000}`); // v1.27.0
    expect(verifyState(two)).toEqual({ scope: 'workspace', subjectId: 'ws-123', appId: null });
  });
});
