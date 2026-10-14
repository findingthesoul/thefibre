import { describe, expect, it } from 'vitest';
import { surfaceUrl } from './branding.js';

// ---------------------------------------------------------------------------
// THE REDIRECT OUT OF `/my` MUST STAY ON ITS OWN STACK.
//
// The Members app's `/my` is a redirect to my.thread now. It builds the
// destination with `surfaceUrl('my-portal', process.env, host)` — from the
// request's host, never a constant — because a staging page that sends
// somebody to production is a bug this repo has shipped before: `surfaceUrl`
// used to send every staging caller to the bare apex, and the first caller
// without an env var handed out a production URL from the staging stack.
//
// So this pins the behaviour the redirect depends on, from the shared side
// where it lives, rather than trusting that a page three apps away still
// passes the host.
// ---------------------------------------------------------------------------

describe('the portal URL a /my redirect builds', () => {
  it('stays on staging when a staging host served the page', () => {
    for (const host of [
      'membership.thefibre.tech',
      'MEMBERSHIP.THEFIBRE.TECH',
      'membership.thefibre.tech:443',
    ]) {
      expect(surfaceUrl('my-portal', {}, host), host).toBe('https://my.thefibre.tech');
    }
  });

  it('goes to production from a production host', () => {
    for (const host of ['membership.thethread.app', 'thethread.app']) {
      expect(surfaceUrl('my-portal', {}, host), host).toBe('https://my.thethread.app');
    }
  });

  it('prefers an explicit env var over both', () => {
    // How every Next app is configured in practice; the host is the fallback
    // for the caller that has no env var, which is where the old bug lived.
    expect(
      surfaceUrl('my-portal', { NEXT_PUBLIC_MY_URL: 'https://my.example.test' }, 'membership.thefibre.tech'),
    ).toBe('https://my.example.test');
  });

  it('falls back to production when there is no host and no env', () => {
    // Not ideal, but it is the safe direction: a real address rather than a
    // broken one. Stated so a change to it is deliberate.
    expect(surfaceUrl('my-portal', {}, null)).toBe('https://my.thethread.app');
  });
});
