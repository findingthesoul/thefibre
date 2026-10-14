// When background work starts after the process boots.
//
// ── Why not at once (2026-10-14) ─────────────────────────────────────────────
//
// A fresh staging machine's first request once took 13.6s. Measured on the
// v359 deploy the same day: Node takes ~9s from exec to listening on a
// shared-cpu-1x machine, the health check passes at that moment and Fly moves
// traffic to it — and then, until this file, `ensureStripeTaxRates` fired at
// +15s and ALL NINE schedulers fired together at +20s, on one shared CPU and
// one outbound connection pool. A person's first click lands in exactly that
// window, and deploy-api.sh's warm-up cannot cover it: it only runs once
// `fly deploy` has returned, which is after the window has passed.
//
// So the first scheduler run waits until +90s, and the jobs start one at a
// time, ten seconds apart, rather than as one burst. Each keeps its own
// five-minute cadence from its own start, so they stay spread out after that.
// Nothing here is urgent: every job is idempotent under its lease and catches
// up on its next tick.

/** The first background job starts this long after boot. */
export const FIRST_RUN_DELAY_MS = 90_000;
/** And each later one this much after the one before it. */
export const STAGGER_MS = 10_000;

/** The boot delay of the i-th background job (0-based). */
export function bootDelay(i: number): number {
  return FIRST_RUN_DELAY_MS + i * STAGGER_MS;
}
