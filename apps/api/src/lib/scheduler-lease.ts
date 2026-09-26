// One process at a time runs a scheduled tick.
//
// Why this exists (2026-09-26, launch list): the API is one Fly machine, and
// to stop every deploy from being a 502 window the Fly config deploys
// blue-green — the new machine boots BESIDE the old one, passes its checks,
// takes the traffic, and only then is the old one destroyed. For that window
// two processes are up, and server.ts fires every scheduler 20 s after boot.
// The usage meter's hourly guard was module memory (`let lastSweepAt = 0`),
// so a fresh process never declined; the access syncs pick "pending" rows
// with no lock at all. Two runners would bill overage twice and invite twice.
//
// The lease is a row per job name in scheduler_lease with an expiry
// (migration 20260926192940). try_scheduler_lease wins when the name is free,
// its lease has expired, or this holder already has it; the holder releases
// when the tick finishes; a holder that dies releases by expiry, so a hung or
// crashed process cannot wedge a job for longer than the TTL.
//
// Declining is the safe answer when the lease cannot be read — the hygiene
// sweep's rule: a missed tick costs five minutes, a doubled one costs money.
// The same lease is what makes `fly scale count 2` safe later; this file is
// the whole prerequisite.

import { hostname } from 'node:os';
import { adminClient } from '../db.js';

/** Stable within a process, distinct across processes and machines. */
export const LEASE_HOLDER = `${process.env.FLY_MACHINE_ID ?? hostname()}:${process.pid}`;

export type LeaseOutcome = 'ran' | 'skipped' | 'unavailable';

/**
 * Run `fn` only if this process wins the lease `name` for `ttlMs`. Returns
 * what happened so a caller can log it; never throws for lease trouble
 * (fn's own errors propagate).
 */
export async function withSchedulerLease(
  name: string,
  ttlMs: number,
  fn: () => Promise<void>,
  holder: string = LEASE_HOLDER,
): Promise<LeaseOutcome> {
  const { data, error } = await adminClient.rpc('try_scheduler_lease', {
    p_name: name,
    p_holder: holder,
    p_ttl_seconds: Math.max(1, Math.ceil(ttlMs / 1000)),
  });
  if (error) {
    console.warn(`[scheduler-lease] ${name}: could not read the lease, skipping`, error.message);
    return 'unavailable';
  }
  if (data !== true) return 'skipped';
  try {
    await fn();
  } finally {
    const { error: relErr } = await adminClient.rpc('release_scheduler_lease', {
      p_name: name,
      p_holder: holder,
    });
    if (relErr) console.warn(`[scheduler-lease] ${name}: release failed (expires by TTL)`, relErr.message);
  }
  return 'ran';
}
