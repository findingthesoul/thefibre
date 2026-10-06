// A customer's own host: the one rule both apps' middleware run
// (docs/domain-package.md part 2). Pure, so a wrong prefix or a missed
// reserved segment fails here, not on book.soul.com.

import { afterEach, describe, expect, it } from 'vitest';
import {
  _clearTenantCache,
  decideTenantPath,
  isOwnHost,
  resolveTenant,
  tenantHostStep,
} from './tenant-host.js';

const CANON = 'https://meet.thethread.app';

describe('decideTenantPath', () => {
  it('rewrites the root and owner-less paths under the owner root', () => {
    expect(decideTenantPath('/', '', 'soul', CANON)).toEqual({ kind: 'rewrite', pathname: '/soul' });
    expect(decideTenantPath('/intro', '', 'soul', CANON)).toEqual({ kind: 'rewrite', pathname: '/soul/intro' });
    expect(decideTenantPath('/intro/confirmed/abc', '?x=1', 'soul', CANON)).toEqual({ kind: 'rewrite', pathname: '/soul/intro/confirmed/abc' });
  });

  it('leaves a path that already carries the root alone — the apps link relatively WITH the segment', () => {
    expect(decideTenantPath('/soul', '', 'soul', CANON)).toEqual({ kind: 'pass' });
    expect(decideTenantPath('/soul/intro/confirmed/abc', '', 'soul', CANON)).toEqual({ kind: 'pass' });
    // A root that merely starts the same is not the root.
    expect(decideTenantPath('/soulmates', '', 'soul', CANON)).toEqual({ kind: 'rewrite', pathname: '/soul/soulmates' });
  });

  it('passes framework and everyone-paths through untouched', () => {
    for (const p of ['/_next/static/x.js', '/api/health', '/favicon.ico', '/embed/list', '/embed.js', '/certificate/TT-1', '/robots.txt']) {
      expect(decideTenantPath(p, '', 'soul', CANON), p).toEqual({ kind: 'pass' });
    }
  });

  it('sends signed-in and sign-in paths to the canonical origin, query kept', () => {
    expect(decideTenantPath('/my', '', 'soul', CANON)).toEqual({ kind: 'redirect', url: `${CANON}/my` });
    expect(decideTenantPath('/auth/callback', '?code=1', 'soul', `${CANON}/`)).toEqual({ kind: 'redirect', url: `${CANON}/auth/callback?code=1` });
    expect(decideTenantPath('/dashboard', '', 'soul', CANON).kind).toBe('redirect');
    expect(decideTenantPath('/sso/land', '?code=x', 'soul', CANON).kind).toBe('redirect');
  });
});

describe('isOwnHost', () => {
  const own = ['meet.thethread.app', 'meet.thefibre.tech'];
  it('is true for our hosts, dev hosts and Vercel previews — exact host matches only', () => {
    expect(isOwnHost('meet.thethread.app', own)).toBe(true);
    expect(isOwnHost('MEET.thethread.app:443', own)).toBe(true);
    expect(isOwnHost('localhost:3001', own)).toBe(true);
    expect(isOwnHost('thefibre-meet-abc.vercel.app', own)).toBe(true);
  });
  it('is false for a customer host, including one that merely contains ours', () => {
    expect(isOwnHost('book.soul.com', own)).toBe(false);
    expect(isOwnHost('meet.thethread.app.evil.example', own)).toBe(false);
    expect(isOwnHost('xmeet.thethread.app', own)).toBe(false);
  });
});

describe('resolveTenant', () => {
  afterEach(() => _clearTenantCache());
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it('accepts a verified answer for THIS app and caches it; a wrong app is not a tenant', async () => {
    let calls = 0;
    const f = (async () => {
      calls += 1;
      return json({ app: 'fibre-meet', root_slug: 'soul', workspace_slug: 'soul' });
    }) as typeof fetch;
    expect(await resolveTenant('book.soul.com', 'fibre-meet', 'https://api', f, 1000)).toEqual({ app: 'fibre-meet', root_slug: 'soul', workspace_slug: 'soul' });
    expect(await resolveTenant('book.soul.com', 'fibre-meet', 'https://api', f, 2000)).not.toBeNull();
    expect(calls).toBe(1);
    expect(await resolveTenant('book.soul.com', 'the-thread', 'https://api', f, 1000)).toBeNull();
  });

  it('a 404 is not a tenant, is cached, and an API failure never becomes an error page', async () => {
    let calls = 0;
    const f404 = (async () => {
      calls += 1;
      return json({ error: 'unknown host' }, 404);
    }) as typeof fetch;
    expect(await resolveTenant('nobody.example', 'fibre-meet', 'https://api', f404, 1000)).toBeNull();
    expect(await resolveTenant('nobody.example', 'fibre-meet', 'https://api', f404, 1500)).toBeNull();
    expect(calls).toBe(1);
    const boom = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    expect(await resolveTenant('down.example', 'fibre-meet', 'https://api', boom, 1000)).toBeNull();
  });
});

describe('tenantHostStep', () => {
  afterEach(() => _clearTenantCache());
  const req = (host: string, pathname: string, search = '') => ({
    nextUrl: { hostname: host, host, pathname, search },
    headers: { get: (n: string) => (n === 'x-forwarded-host' ? host : null) },
  });
  const step = (fetchImpl: typeof fetch) =>
    tenantHostStep({
      app: 'fibre-meet',
      canonicalOrigin: CANON,
      ownHosts: ['meet.thethread.app'],
      apiBase: 'https://api',
      rewrite: (_r, pathname) => ({ rewrite: pathname }),
      redirect: (url) => ({ redirect: url }),
      fetchImpl,
    });
  const verified = (async () => new Response(JSON.stringify({ app: 'fibre-meet', root_slug: 'soul', workspace_slug: 'soul' }), { status: 200 })) as typeof fetch;

  it('does nothing on our own host — old links are untouched, no API call', async () => {
    let calls = 0;
    const counting = (async () => {
      calls += 1;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    expect(await step(counting)(req('meet.thethread.app', '/soul/intro'))).toBeNull();
    expect(calls).toBe(0);
  });

  it('rewrites on a verified tenant host, redirects the sign-in paths, passes the rest', async () => {
    const s = step(verified);
    const r = await s(req('book.soul.com', '/intro'));
    expect(r && 'respond' in r && r.respond(req('book.soul.com', '/intro'))).toEqual({ rewrite: '/soul/intro' });
    expect(await s(req('book.soul.com', '/my', '?x'))).toEqual({ final: { redirect: `${CANON}/my?x` } });
    expect(await s(req('book.soul.com', '/soul/intro'))).toBeNull();
    expect(await s(req('book.soul.com', '/_next/static/a.js'))).toBeNull();
  });
});
