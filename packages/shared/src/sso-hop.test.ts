// The apex logic decides whether a link travels on a shared cookie or
// through the SSO hop — wrong answers either break click-through or mint
// handoff codes for nothing. Locked here because the two-apex split
// (thefibre.app vs *.thethread.app) is a deliberate, load-bearing choice.

import { describe, expect, it } from 'vitest';
import { crossAppHref, isCrossApex } from './sso-hop.js';

describe('isCrossApex', () => {
  it('same apex: subdomains of one registrable domain', () => {
    expect(isCrossApex('https://app.thethread.app', 'https://meet.thethread.app')).toBe(false);
    expect(isCrossApex('https://thefibre.app', 'https://www.thefibre.app')).toBe(false);
  });

  it('cross apex: the two production apexes', () => {
    expect(isCrossApex('https://thefibre.app', 'https://app.thethread.app')).toBe(true);
    expect(isCrossApex('https://meet.thethread.app', 'https://thefibre.app')).toBe(true);
  });

  it('compares the last two labels only (deep subdomains)', () => {
    expect(isCrossApex('https://a.b.thefibre.app', 'https://thefibre.app')).toBe(false);
  });

  it('localhost never hops, regardless of port', () => {
    expect(isCrossApex('http://localhost:3000', 'http://localhost:3002')).toBe(false);
    expect(isCrossApex('http://app.localhost:3000', 'http://localhost:3002')).toBe(false);
  });

  it('an IP is its own apex (the local two-apex simulation trick)', () => {
    expect(isCrossApex('http://localhost:3000', 'http://127.0.0.1:3001')).toBe(true);
  });
});

describe('crossAppHref', () => {
  const prod = {}; // no overrides → registry defaults

  it('same-apex target → plain absolute URL', () => {
    expect(crossAppHref('the-thread', 'fibre-meet', prod)).toBe('https://meet.thethread.app');
  });

  it('same-apex with next → URL with the path joined', () => {
    expect(crossAppHref('the-thread', 'fibre-meet', prod, '/dashboard')).toBe(
      'https://meet.thethread.app/dashboard',
    );
  });

  it('cross-apex target → relative hop link on the CURRENT app', () => {
    expect(crossAppHref('fibre-platform', 'the-thread', prod)).toBe('/sso/hop?to=the-thread');
  });

  it('cross-apex with next → next carried into the hop query', () => {
    expect(crossAppHref('fibre-platform', 'fibre-meet', prod, '/settings')).toBe(
      '/sso/hop?to=fibre-meet&next=%2Fsettings',
    );
  });

  it('env overrides move the apex decision (the staging single-apex case)', () => {
    const staging = {
      NEXT_PUBLIC_FIBRE_URL: 'https://thefibre.tech',
      NEXT_PUBLIC_THREAD_URL: 'https://thread.thefibre.tech',
    };
    // One apex on staging → no hop, plain link.
    expect(crossAppHref('fibre-platform', 'the-thread', staging)).toBe(
      'https://thread.thefibre.tech',
    );
  });
});
