// Which browser origins may make a credentialed call to this API, and with
// which methods. Moved out of server.ts on 2026-10-01 so it can be tested:
// server.ts starts a listener when imported, so nothing in it had a test, and
// the two lists that lived there had both gone stale without anything noticing
// (Models' dev port was missing; PUT was missing while twenty-seven PUT routes
// existed). cors-origins.test.ts now holds each list against the thing it is
// supposed to follow.
//
// Default-deny: an origin that is not recognised gets no
// Access-Control-Allow-Origin header and the browser blocks the request. A
// reflective fallback to "*" would defeat credentials:true (browsers refuse
// the combination anyway). A request with no Origin header (server-to-server,
// same-origin, native fetch) never reaches this check.

import {
  APP_IDS,
  appUrl,
  stagingAppUrl,
  stagingSurfaceUrl,
  SURFACES,
  surfaceUrl,
  type SurfaceKey,
} from '@thefibre/shared';

const SURFACE_KEYS = Object.keys(SURFACES) as SurfaceKey[];

/**
 * Every verb a route is registered with. cors-origins.test.ts reads
 * src/routes and fails when a route uses a verb that is not here — a browser
 * call with a missing verb fails its preflight, and nothing server-side logs
 * it. (Every PUT caller happened to be a server action until now, which is
 * the only reason the gap was invisible.)
 */
export const CORS_ALLOW_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

/**
 * Local development: any app on this machine, on the 30xx ports `pnpm dev`
 * hands out. A pattern and not a list, because the list was the fourth "new
 * app forgotten in a hand-written list" bug: Models (:3009) was never added.
 * A localhost origin is by definition the caller's own machine, so naming the
 * ports one by one bought nothing.
 */
const DEV_ORIGIN_RE = /^http:\/\/localhost:30\d\d$/;

// Vercel preview deploys, e.g. https://thefibre-meet-git-feature-x-<team>.vercel.app
//
// KNOWN TO BE WIDER THAN IT LOOKS (2026-10-01, docs/build-plan.md): it matches
// any Vercel project whose NAME starts with one of ours, and project names on
// vercel.app are first come, first served. The exposure is small — the API
// authenticates by bearer token, never by cookie, so an allowed origin without
// a token reads nothing — but it is not the allowlist it reads as. Tightening
// it means pinning the team suffix, or dropping it now that staging has real
// hostnames. `thefibre-web` was removed from it on the same day: no project
// has that name (the platform's project is `thefibre`), so it matched nothing.
const VERCEL_PREVIEW_RE =
  /^https:\/\/(thefibre-meet|thefibre-thread|thefibre-flow|thefibre-pulse|thefibre-membership|thefibre-my|thefibre-connections|thefibre-models)-[a-z0-9-]+\.vercel\.app$/;

/**
 * Build the origin check for one environment. Takes `env` so a test can ask
 * what production and staging each allow without being either.
 */
export function buildOriginCheck(
  env: Record<string, string | undefined> = process.env,
): (origin: string) => boolean {
  // Derived from the app registry, NEVER hand-listed (the v0.39.1 rule): the
  // hand-written copy was missing membership.thefibre.tech on staging, which
  // CORS-blocked the join page during the 2026-09-05 payment rehearsal.
  const allowed = new Set<string>([
    ...APP_IDS.map((slug) => appUrl(slug)),
    // Platform surfaces (branding.ts SURFACES) — same derived-never-listed rule.
    ...SURFACE_KEYS.map((k) => surfaceUrl(k)),
  ]);

  // The staging stack's own origins, derived the same way and added ONLY on
  // the staging API: a staging page has no business making a credentialed
  // call to the production API. FLY_APP_NAME is injected by Fly; off Fly it
  // is empty and nothing is added.
  //
  // The SURFACES are included since 2026-10-01. Before that only the apps
  // were derived, and my.thefibre.tech worked on staging only because the
  // hand-written CORS_ORIGINS secret happened to name it — the secret that
  // cannot be read back, and that a rename cannot follow (2026-09-21).
  if (env.FLY_APP_NAME === 'thefibre-api-staging') {
    for (const slug of APP_IDS) allowed.add(stagingAppUrl(slug));
    for (const k of SURFACE_KEYS) allowed.add(stagingSurfaceUrl(k));
  }

  // Extras, comma-separated. For a one-off origin; nothing should depend on it.
  for (const o of (env.CORS_ORIGINS ?? '').split(',')) {
    const trimmed = o.trim();
    if (trimmed) allowed.add(trimmed);
  }

  return (origin: string) =>
    allowed.has(origin) || DEV_ORIGIN_RE.test(origin) || VERCEL_PREVIEW_RE.test(origin);
}

/** The check for the process we are running in. */
export const isAllowedOrigin = buildOriginCheck();
