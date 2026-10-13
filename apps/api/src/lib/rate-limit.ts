// Per-IP rate limiting for the public read API, and for the discount-code
// validator.
//
// In-memory, fixed window. The API runs as a single Fly machine, so one
// process sees every request and a shared store would be ceremony. Two honest
// consequences: the window resets on deploy, and if we ever scale past one
// machine each machine counts separately — so a limit written as "20 an hour"
// is really 20 × however many machines are serving, and nobody should read
// the number in a call site as a hard ceiling.
//
// That was fine while this only guarded a read surface whose data is already
// public. Since 2026-10-13 it also guards /membership/public/validate-code,
// where the data is NOT public — it answers "does this code exist", and the
// thing being guessed is money off a membership. It is still an abuse brake
// rather than a security control, and the control is elsewhere: a code's own
// usage_limit, enforced atomically at redemption. Move this to Redis if the
// machine count changes, and before anything depends on the number being
// exact.

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

/**
 * Is this bucket already spent? WITHOUT spending one.
 *
 * For the gates that charge only FAILURES — the join and enrol paths, where a
 * blanket limit would turn a real person away. Those were still an oracle
 * without this: once the bucket was empty, a wrong guess got a 429 and a
 * RIGHT one sailed through to a 200, so the status code itself answered "is
 * this code valid" at full speed and with a perfect signal. Counting only
 * failures is the correct intent and it has to be paired with REFUSING on
 * exhaustion, whether the code would have been right or wrong.
 *
 * So: check this before the lookup, and `hit()` only after a failed one. A
 * request carrying no code never touches the bucket at all.
 *
 * Read-only on purpose — calling `hit()` to find out would consume the
 * attempt it is asking about, which is how a check becomes the thing it
 * meant to measure.
 */
export function isExhausted(key: string, limit: number): boolean {
  const b = buckets.get(key);
  if (!b || b.resetAt <= Date.now()) return false;
  return b.count >= limit;
}

/** Seconds until this bucket resets, for Retry-After on a refusal that did
 *  not come from `hit()`. Zero when there is nothing to wait for. */
export function resetSecondsFor(key: string): number {
  const b = buckets.get(key);
  const left = b ? b.resetAt - Date.now() : 0;
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

/**
 * Test seam — lets the unit tests (rate-limit.test.ts) assert the limiter
 * without waiting out a window. This comment used to credit the contract
 * script; that script talks to a deployed API over HTTP and cannot reach
 * this Map, so for as long as it said that, nothing called this and nothing
 * tested this file.
 */
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
