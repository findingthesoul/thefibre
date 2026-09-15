import { describe, expect, it } from 'vitest';
import { STAGING_PROJECT_REF, parseEnvFile, refuseNonStaging, resolveConfig } from './env.js';

const staging = `https://${STAGING_PROJECT_REF}.supabase.co`;

describe('the staging guard', () => {
  it('lets staging through', () => {
    expect(refuseNonStaging(staging, false)).toBeNull();
  });
  it('refuses any other project unless allowed on purpose', () => {
    expect(refuseNonStaging('https://abcdefgh.supabase.co', false)).toMatch(/not the staging project/);
    expect(refuseNonStaging('https://abcdefgh.supabase.co', true)).toBeNull();
  });
  it('has nothing to judge without a URL (the pasted-token path)', () => {
    expect(refuseNonStaging(undefined, false)).toBeNull();
  });
});

describe('resolveConfig', () => {
  it('prefers a pasted token and needs nothing else', () => {
    const c = resolveConfig({ FIBRE_JWT: 'eyJ.x.y' }, null);
    expect(c.credentials).toEqual({ mode: 'jwt', jwt: 'eyJ.x.y' });
    expect(c.api).toBe('https://thefibre-api-staging.fly.dev');
    expect(c.appId).toBe('fibre-platform');
  });

  it('mints when the four values are present', () => {
    const c = resolveConfig(
      {
        NEXT_PUBLIC_SUPABASE_URL: staging,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
        SUPABASE_SERVICE_ROLE_KEY: 'service',
        FIBRE_USER_EMAIL: 'sjoerd@soul.com',
        FIBRE_API: 'http://localhost:8080/',
      },
      '/x/.env.staging',
    );
    expect(c.credentials).toMatchObject({ mode: 'mint', userEmail: 'sjoerd@soul.com' });
    expect(c.api).toBe('http://localhost:8080');
  });

  it('names what is missing', () => {
    expect(() => resolveConfig({ NEXT_PUBLIC_SUPABASE_URL: staging }, '/x/.env.staging')).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY, FIBRE_USER_EMAIL/,
    );
  });

  it('refuses production even with a pasted token when a URL says production', () => {
    expect(() =>
      resolveConfig({ FIBRE_JWT: 'eyJ.x.y', NEXT_PUBLIC_SUPABASE_URL: 'https://prodprod.supabase.co' }, null),
    ).toThrow(/not the staging project/);
  });
});

describe('parseEnvFile', () => {
  it('splits at the first = and drops quotes and comments', () => {
    expect(parseEnvFile('# c\nA=1\nB="x=y"\n\nC = z ')).toEqual({ A: '1', B: 'x=y', C: 'z' });
  });
});
