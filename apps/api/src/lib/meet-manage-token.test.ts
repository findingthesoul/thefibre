import { afterEach, describe, expect, it, vi } from 'vitest';
import { isManageToken, manageQuery, manageToken } from './meet-manage-token.js';

describe('the Meet manage token', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is stable for one booking and salt, and differs per booking and per salt', () => {
    vi.stubEnv('SSO_INTERNAL_SECRET', 's1');
    const a = manageToken('b1', 'salt1');
    expect(manageToken('b1', 'salt1')).toBe(a);
    expect(manageToken('b2', 'salt1')).not.toBe(a);
    expect(manageToken('b1', 'salt2')).not.toBe(a); // a new salt revokes
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes, base64url, no padding
  });

  it('depends on the server secret — rotating it changes every token', () => {
    vi.stubEnv('SSO_INTERNAL_SECRET', 's1');
    const a = manageToken('b1', 'salt1');
    vi.stubEnv('SSO_INTERNAL_SECRET', 's2');
    expect(manageToken('b1', 'salt1')).not.toBe(a);
  });

  it('verifies only the right token; anything missing is false', () => {
    vi.stubEnv('SSO_INTERNAL_SECRET', 's1');
    const t = manageToken('b1', 'salt1');
    expect(isManageToken('b1', 'salt1', t)).toBe(true);
    expect(isManageToken('b1', 'salt1', t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A'))).toBe(false);
    expect(isManageToken('b2', 'salt1', t)).toBe(false);
    expect(isManageToken('b1', 'salt2', t)).toBe(false);
    expect(isManageToken('b1', 'salt1', '')).toBe(false);
    expect(isManageToken('b1', 'salt1', null)).toBe(false);
    expect(isManageToken('b1', null, t)).toBe(false);
    expect(isManageToken('b1', 'salt1', 'short')).toBe(false);
  });

  it('refuses to mint on Fly without the secret', () => {
    vi.stubEnv('SSO_INTERNAL_SECRET', '');
    vi.stubEnv('FLY_APP_NAME', 'thefibre-api-staging');
    expect(() => manageToken('b1', 's')).toThrow(/SSO_INTERNAL_SECRET/);
  });

  it('manageQuery adds ?t= or &t=, or nothing', () => {
    expect(manageQuery('a b')).toBe('?t=a%20b');
    expect(manageQuery('x', '&')).toBe('&t=x');
    expect(manageQuery(null)).toBe('');
  });
});
