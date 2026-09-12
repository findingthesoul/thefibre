// The registry is the single source of app URLs — CORS, the app switcher,
// email CTAs and the embed generators all derive from it. These tests lock
// the resolution order (env override → registry default) and the two-apex
// production topology decided 2026-09-06 (CHANGELOG v0.52.0).

import { describe, expect, it } from 'vitest';
import {
  APPS,
  FOOTER_LINKS,
  FOOTER_PATHS,
  SURFACES,
  appUrl,
  defaultEmailFrom,
  surfaceUrl,
} from './branding.js';

describe('appUrl', () => {
  it('returns the registry default when no env is passed', () => {
    expect(appUrl('fibre-platform')).toBe('https://thefibre.app');
  });

  it('prefers a non-empty env override', () => {
    expect(appUrl('the-thread', { NEXT_PUBLIC_THREAD_URL: 'https://thread.thefibre.tech' })).toBe(
      'https://thread.thefibre.tech',
    );
  });

  it('falls back past an empty/whitespace override (unset-but-present vars)', () => {
    expect(appUrl('the-thread', { NEXT_PUBLIC_THREAD_URL: '' })).toBe('https://app.thethread.app');
    expect(appUrl('the-thread', { NEXT_PUBLIC_THREAD_URL: '  ' })).toBe('https://app.thethread.app');
  });
});

describe('the production topology (v0.52.0 domain migration)', () => {
  it('fibre web stays on thefibre.app', () => {
    expect(APPS['fibre-platform'].url).toBe('https://thefibre.app');
  });

  it('the five delivery apps live on thethread.app (Thread takes app.)', () => {
    expect(APPS['the-thread'].url).toBe('https://app.thethread.app');
    expect(APPS['fibre-meet'].url).toBe('https://meet.thethread.app');
    expect(APPS['fibre-flow'].url).toBe('https://flow.thethread.app');
    expect(APPS['fibre-pulse'].url).toBe('https://pulse.thethread.app');
    expect(APPS['membership'].url).toBe('https://membership.thethread.app');
  });

  it('every registry URL is a valid https origin with no trailing slash', () => {
    for (const meta of Object.values(APPS)) {
      const u = new URL(meta.url);
      expect(u.protocol).toBe('https:');
      expect(meta.url.endsWith('/')).toBe(false);
      expect(u.pathname).toBe('/');
    }
  });
});

describe('defaultEmailFrom', () => {
  it('EMAIL_FROM env wins; otherwise the public-brand default (The Thread — branding pivot 2026-09-08)', () => {
    expect(defaultEmailFrom({ EMAIL_FROM: 'X <x@example.org>' })).toBe('X <x@example.org>');
    expect(defaultEmailFrom({})).toBe('The Thread <noreply@thefibre.app>');
  });
});

describe('surfaceUrl — the website surface (registered 2026-09-12)', () => {
  it('falls back to production when the environment says nothing', () => {
    expect(surfaceUrl('website', {})).toBe('https://thethread.app');
    expect(surfaceUrl('website', undefined)).toBe('https://thethread.app');
  });

  it('follows NEXT_PUBLIC_WEBSITE_URL when one is set', () => {
    // The bug this locks: the shared marketing footer had the production
    // host as a const, so every link in it — Sign in included — walked a
    // STAGING visitor into the live app, which is the one thing a separate
    // staging apex exists to prevent.
    expect(surfaceUrl('website', { NEXT_PUBLIC_WEBSITE_URL: 'https://thefibre.tech' })).toBe(
      'https://thefibre.tech',
    );
  });

  it('is registered as a surface, not an app — it has no catalogue entry', () => {
    expect(SURFACES.website.devPort).toBe(3006);
    expect(Object.keys(APPS)).not.toContain('website');
  });

  it('every surface URL is a valid https origin with no trailing slash', () => {
    for (const meta of Object.values(SURFACES)) {
      const u = new URL(meta.url);
      expect(u.protocol).toBe('https:');
      expect(meta.url.endsWith('/')).toBe(false);
      expect(u.pathname).toBe('/');
    }
  });
});

describe('FOOTER_PATHS / FOOTER_LINKS', () => {
  it('the email links stay pinned to production — an inbox is read from anywhere', () => {
    expect(FOOTER_LINKS.privacy).toBe('https://thethread.app/privacy-policy');
    expect(FOOTER_LINKS.legal).toBe('https://thethread.app/terms');
  });

  it('the paths are exported separately so a PAGE can join them to its own host', () => {
    expect(FOOTER_PATHS.privacy).toBe('/privacy-policy');
    expect(`${surfaceUrl('website', { NEXT_PUBLIC_WEBSITE_URL: 'https://thefibre.tech' })}${FOOTER_PATHS.privacy}`).toBe(
      'https://thefibre.tech/privacy-policy',
    );
  });
});
