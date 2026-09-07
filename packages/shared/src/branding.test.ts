// The registry is the single source of app URLs — CORS, the app switcher,
// email CTAs and the embed generators all derive from it. These tests lock
// the resolution order (env override → registry default) and the two-apex
// production topology decided 2026-09-06 (CHANGELOG v0.52.0).

import { describe, expect, it } from 'vitest';
import { APPS, appUrl, defaultEmailFrom } from './branding.js';

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
