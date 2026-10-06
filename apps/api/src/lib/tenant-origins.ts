// The dynamic half of the CORS allow-list: verified customer web hosts
// (docs/domain-package.md, part 2).
//
// lib/cors-origins.ts is a pure, static set built at import from the app
// registry, and its tests keep it that way. A customer host is neither
// static nor in the registry, so it lives here: a Set refreshed from
// `workspace_domain` at most once a minute, consulted synchronously by the
// same `origin` callbacks. A refresh failure keeps the last good set — a
// database hiccup must not CORS-block a booking page that worked a minute
// ago — and the first request after boot answers from an empty set while
// the first refresh runs (the page retries; the gap is one request).

import { verifiedWebOrigins } from './workspace-domain.js';

const TTL_MS = 60_000;
let origins = new Set<string>();
let refreshedAt = 0;
let inflight: Promise<void> | null = null;

function refresh(): void {
  if (inflight) return;
  inflight = verifiedWebOrigins()
    .then((list) => {
      origins = new Set(list);
      refreshedAt = Date.now();
    })
    .catch((e) => console.warn('[tenant-origins] refresh failed, keeping the last set', e instanceof Error ? e.message : e))
    .finally(() => {
      inflight = null;
    });
}

/** Is this origin a verified customer host? Synchronous; kicks a refresh
 *  when the set is older than a minute. */
export function isTenantOrigin(origin: string, now = Date.now()): boolean {
  if (now - refreshedAt > TTL_MS) refresh();
  return origins.has(origin);
}

/** For tests and for the check route: replace the set outright. */
export function _setTenantOrigins(list: string[], at = Date.now()): void {
  origins = new Set(list);
  refreshedAt = at;
}
