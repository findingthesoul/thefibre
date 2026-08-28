// Per-IP rate limiting for the public read API.
//
// In-memory, fixed window. The API runs as a single Fly machine, so one
// process sees every request and a shared store would be ceremony. Two honest
// consequences: the window resets on deploy, and if we ever scale past one
// machine each machine counts separately. Both are acceptable for a read
// surface whose data is already public — this is an abuse brake, not a
// security control. Move it to Redis if the machine count changes.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Sweep expired buckets so an IP that visits once doesn't live forever.
const SWEEP_EVERY_MS = 60_000;
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets — the value for Retry-After. */
  resetSeconds: number;
};

export function hit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;

  const remaining = Math.max(0, limit - b.count);
  return {
    allowed: b.count <= limit,
    limit,
    remaining,
    resetSeconds: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
  };
}

/** Test seam — the contract script asserts the limiter without waiting a minute. */
export function resetAllBuckets(): void {
  buckets.clear();
  lastSweep = 0;
}

/**
 * The caller's IP. Fly terminates TLS and sets Fly-Client-IP; X-Forwarded-For
 * is the fallback and its FIRST entry is the client (the rest are proxies).
 * Falls back to a single shared bucket rather than to per-request buckets —
 * an unidentifiable caller should be limited, not exempted.
 */
export function clientIp(headers: Headers): string {
  const fly = headers.get('fly-client-ip');
  if (fly) return fly;
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'unknown';
}
