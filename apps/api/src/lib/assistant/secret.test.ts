import { afterEach, describe, expect, it } from 'vitest';
import { currentKid, decryptSecret, encryptSecret, kidOf } from './secret.js';

const SSO = 'sso-secret-long-enough-for-the-test-000000';
const DEDICATED = 'assistant-key-secret-long-enough-111111';

afterEach(() => {
  delete process.env.ASSISTANT_KEY_SECRET;
  delete process.env.SSO_INTERNAL_SECRET;
});

describe('workspace key encryption', () => {
  it('uses the dedicated secret when it exists, and says so in the key id', () => {
    process.env.ASSISTANT_KEY_SECRET = DEDICATED;
    process.env.SSO_INTERNAL_SECRET = SSO;
    const packed = encryptSecret('sk-ant-api03-example-1234');
    expect(currentKid()).toBe(1);
    expect(kidOf(packed)).toBe(1);
    expect(decryptSecret(packed)).toBe('sk-ant-api03-example-1234');
    expect(packed).not.toContain('sk-ant');
  });

  it('falls back to the SSO secret only when no dedicated one is set', () => {
    process.env.SSO_INTERNAL_SECRET = SSO;
    const packed = encryptSecret('sk-ant-api03-example-1234');
    expect(kidOf(packed)).toBe(0);
    expect(decryptSecret(packed)).toBe('sk-ant-api03-example-1234');
  });

  it('a row written under the fallback still decrypts after the dedicated secret arrives', () => {
    process.env.SSO_INTERNAL_SECRET = SSO;
    const old = encryptSecret('sk-ant-old-row');
    process.env.ASSISTANT_KEY_SECRET = DEDICATED;
    expect(decryptSecret(old)).toBe('sk-ant-old-row');
    // and a re-encrypt under the current kid is how a rotation pass migrates it
    const fresh = encryptSecret(decryptSecret(old));
    expect(kidOf(fresh)).toBe(1);
  });

  it('rotating the secret a row depends on makes that row unreadable, loudly', () => {
    process.env.ASSISTANT_KEY_SECRET = DEDICATED;
    const packed = encryptSecret('sk-ant-x');
    process.env.ASSISTANT_KEY_SECRET = 'a-rotated-secret-that-is-also-long-enough';
    expect(() => decryptSecret(packed)).toThrow();
  });

  it('refuses to encrypt with a missing or short secret', () => {
    expect(() => encryptSecret('sk-ant-x')).toThrow(/SSO_INTERNAL_SECRET is not set/);
    process.env.ASSISTANT_KEY_SECRET = 'short';
    expect(currentKid()).toBe(0);
  });
});
