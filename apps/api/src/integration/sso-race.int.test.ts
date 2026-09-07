// The SSO handoff's single-use claim — the same race-safe UPDATE the API's
// /sso/redeem runs (update … .is('used_at', null)): when N redeemers race
// one code, EXACTLY one wins. Session-fixation and replay protection hangs
// on this row-level atomicity, so it gets proven against real Postgres.

import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { service } from './staging.js';

const codes: string[] = [];

afterAll(async () => {
  if (codes.length) await service.from('sso_handoff').delete().in('code', codes);
});

async function mintCode(expiresInMs: number): Promise<string> {
  const code = `int-test-${randomBytes(24).toString('base64url')}`;
  codes.push(code);
  const { error } = await service.from('sso_handoff').insert({
    code,
    user_id: '00000000-0000-0000-0000-000000000000',
    email: 'int-test@example.com',
    target_app: 'fibre-meet',
    expires_at: new Date(Date.now() + expiresInMs).toISOString(),
  });
  expect(error).toBeNull();
  return code;
}

/** The exact claim the API runs. */
function claim(code: string, targetApp = 'fibre-meet') {
  return service
    .from('sso_handoff')
    .update({ used_at: new Date().toISOString() })
    .eq('code', code)
    .eq('target_app', targetApp)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('email')
    .maybeSingle();
}

describe('sso_handoff single-use claim', () => {
  it('eight concurrent redeemers: exactly one wins', async () => {
    const code = await mintCode(60_000);
    const results = await Promise.all(Array.from({ length: 8 }, () => claim(code)));
    const winners = results.filter((r) => r.data !== null);
    expect(winners.length).toBe(1);
    expect(winners[0].data?.email).toBe('int-test@example.com');
  });

  it('a claimed code cannot be claimed again (replay)', async () => {
    const code = await mintCode(60_000);
    expect((await claim(code)).data).not.toBeNull();
    expect((await claim(code)).data).toBeNull();
  });

  it('an expired code never redeems', async () => {
    const code = await mintCode(-1_000);
    expect((await claim(code)).data).toBeNull();
  });

  it('the wrong target app never redeems (code bound to its destination)', async () => {
    const code = await mintCode(60_000);
    expect((await claim(code, 'the-thread')).data).toBeNull();
    // …and the right app still can afterwards.
    expect((await claim(code)).data).not.toBeNull();
  });
});
