import { describe, expect, it } from 'vitest';
import { isStagingApi, stackSurfaceUrl } from './stack-urls.js';

// ---------------------------------------------------------------------------
// The point of this module is that it is right WITHOUT an env override, so
// every case below passes an env with no URL variables in it.
//
// Before it existed, the staging API reached these URLs through a Fly secret
// (`NEXT_PUBLIC_MY_URL`). That worked — verified on the running machine — but
// deleting the secret would have pointed every staging email, calendar
// subscription and invoice link at PRODUCTION, silently.
// ---------------------------------------------------------------------------
describe('which stack this API is', () => {
  it('knows the staging app by name', () => {
    expect(isStagingApi({ FLY_APP_NAME: 'thefibre-api-staging' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isStagingApi({ FLY_APP_NAME: 'thefibre-api' } as NodeJS.ProcessEnv)).toBe(false);
    // No FLY_APP_NAME at all is local development, which must behave like
    // production rather than like staging: a developer's absolute links
    // should not quietly point at somebody else's test stack.
    expect(isStagingApi({} as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe('a portal link with no env override', () => {
  it('is the .tech portal on the staging API', () => {
    expect(stackSurfaceUrl('my-portal', { FLY_APP_NAME: 'thefibre-api-staging' } as NodeJS.ProcessEnv)).toBe(
      'https://my.thefibre.tech',
    );
  });

  it('is the production portal on the production API', () => {
    expect(stackSurfaceUrl('my-portal', { FLY_APP_NAME: 'thefibre-api' } as NodeJS.ProcessEnv)).toBe(
      'https://my.thethread.app',
    );
  });

  it('is the production portal with no FLY_APP_NAME', () => {
    expect(stackSurfaceUrl('my-portal', {} as NodeJS.ProcessEnv)).toBe('https://my.thethread.app');
  });

  it('never answers production to the staging API — the whole point', () => {
    const staging = stackSurfaceUrl('my-portal', {
      FLY_APP_NAME: 'thefibre-api-staging',
    } as NodeJS.ProcessEnv);
    // Asserted as an absence as well, because a future change to STAGING_APEX
    // or SURFACES could make the positive assertion above pass while still
    // sending a staging reader somewhere on the production domain.
    expect(staging).not.toContain('thethread.app');
    expect(staging).toContain('thefibre.tech');
  });
});

describe('an explicit override still wins', () => {
  it('is used on either stack', () => {
    // Somebody who sets the variable has said something deliberate — a branch
    // deployment, a local tunnel — and derivation must not overrule them.
    const env = {
      FLY_APP_NAME: 'thefibre-api-staging',
      NEXT_PUBLIC_MY_URL: 'https://my.example.test',
    } as NodeJS.ProcessEnv;
    expect(stackSurfaceUrl('my-portal', env)).toBe('https://my.example.test');
  });

  it('is ignored when blank, rather than producing an empty link', () => {
    const env = {
      FLY_APP_NAME: 'thefibre-api-staging',
      NEXT_PUBLIC_MY_URL: '   ',
    } as NodeJS.ProcessEnv;
    expect(stackSurfaceUrl('my-portal', env)).toBe('https://my.thefibre.tech');
  });
});
