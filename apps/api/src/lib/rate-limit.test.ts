// The abuse brake on the public read API, locked down.
//
// `resetAllBuckets` has existed as a "test seam" since the limiter was
// written, and its comment claimed the contract script used it. The contract
// script talks to a deployed API over HTTP and cannot reach an in-process
// Map, so nothing ever called the seam and nothing ever tested this file.
// That mattered more than it looks: the limiter decides whether a stranger's
// website can keep reading the published thread routes, and its boundary
// behaviour (the request exactly ON the limit is allowed, the next one is
// not) is the kind of off-by-one that no one notices until an integrator is
// throttled a request early.
//
// `clientIp` is tested here too because its fallback is a security-relevant
// choice: an unidentifiable caller shares one bucket rather than getting a
// fresh one, so being unidentifiable is not a way to be exempt.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientIp, hit, resetAllBuckets } from './rate-limit.js';

afterEach(() => {
  resetAllBuckets();
  vi.useRealTimers();
});

describe('hit', () => {
  it('allows exactly `limit` requests, then refuses', () => {
    const results = Array.from({ length: 4 }, () => hit('ip-a', 3, 60_000));

    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
  });

  it('counts down remaining and never reports a negative', () => {
    expect(hit('ip-b', 2, 60_000).remaining).toBe(1);
    expect(hit('ip-b', 2, 60_000).remaining).toBe(0);
    // Over the limit: still 0, not -1. This value goes out in a header.
    expect(hit('ip-b', 2, 60_000).remaining).toBe(0);
  });

  it('keeps a separate budget per key', () => {
    hit('ip-c', 1, 60_000);
    expect(hit('ip-c', 1, 60_000).allowed).toBe(false);
    // A different caller is untouched by the first one's spending.
    expect(hit('ip-d', 1, 60_000).allowed).toBe(true);
  });

  it('reports the window in whole seconds, never zero', () => {
    // Retry-After: 0 would invite an immediate retry, so the floor is 1.
    expect(hit('ip-e', 5, 200).resetSeconds).toBe(1);
    expect(hit('ip-f', 5, 60_000).resetSeconds).toBe(60);
  });

  it('forgives the caller once the window has passed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T02:00:00Z'));

    expect(hit('ip-g', 1, 60_000).allowed).toBe(true);
    expect(hit('ip-g', 1, 60_000).allowed).toBe(false);

    vi.setSystemTime(new Date('2026-09-12T02:01:01Z'));
    expect(hit('ip-g', 1, 60_000).allowed).toBe(true);
  });

  it('the window is fixed, not sliding — spending late does not extend it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T02:00:00Z'));
    hit('ip-h', 2, 60_000);

    // 59s in: still the same window, so only one request is left in it.
    vi.setSystemTime(new Date('2026-09-12T02:00:59Z'));
    expect(hit('ip-h', 2, 60_000).allowed).toBe(true);
    expect(hit('ip-h', 2, 60_000).allowed).toBe(false);

    // 61s: a brand-new window, full budget, despite spending a second ago.
    vi.setSystemTime(new Date('2026-09-12T02:01:01Z'));
    expect(hit('ip-h', 2, 60_000).allowed).toBe(true);
  });
});

describe('clientIp', () => {
  it('prefers Fly-Client-IP, which Fly sets after terminating TLS', () => {
    const h = new Headers({ 'fly-client-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' });

    expect(clientIp(h)).toBe('1.2.3.4');
  });

  it('falls back to the FIRST X-Forwarded-For entry — the client, not a proxy', () => {
    const h = new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1, 10.0.0.2' });

    expect(clientIp(h)).toBe('1.2.3.4');
  });

  it('an unidentifiable caller shares one bucket rather than escaping the limit', () => {
    expect(clientIp(new Headers())).toBe('unknown');

    // The consequence worth locking: two anonymous callers spend the SAME
    // budget, so stripping headers throttles you rather than exempting you.
    const key = clientIp(new Headers());
    hit(key, 1, 60_000);
    expect(hit(clientIp(new Headers()), 1, 60_000).allowed).toBe(false);
  });

  it('ignores an empty X-Forwarded-For rather than bucketing on empty string', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '   ' }))).toBe('unknown');
  });
});
