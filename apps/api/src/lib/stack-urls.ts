// Which stack is this API, for the absolute URLs it puts in emails.
//
// THE PROBLEM THIS SOLVES. `surfaceUrl(key, env, host?)` resolves in three
// steps: an env override, then the HOST the page is served from, then
// production. A Next app always has the override set and a browser request
// always has a host — but this API is neither. It has no request host when it
// writes an email, so without an override it reaches the third step and hands
// a STAGING reader a PRODUCTION link.
//
// Today that does not happen, because `NEXT_PUBLIC_MY_URL` is set as a secret
// on `thefibre-api-staging`. Verified on 2026-10-14 by reading it off the
// running machine: `https://my.thefibre.tech`. So the behaviour is right.
//
// It is right for a reason nobody can see, though. Delete that secret and
// every membership email, calendar subscription, invoice link and
// `{my.thread}` token on staging starts pointing at production — silently,
// with nothing failing. A correctness that depends on remembering a secret is
// a correctness that expires.
//
// So the stack is DERIVED, the way `standardTermsUrl` already derives it, and
// the env override still wins where somebody has set one deliberately. That
// turns a thing to remember into a default that cannot be forgotten.
//
// (`FLY_APP_NAME` is what this API already uses to know which stack it is —
// see lib/cors-origins.ts — rather than a second signal that could disagree.)
import { surfaceUrl, type SurfaceKey } from '@thefibre/shared';

const STAGING_API_APP = 'thefibre-api-staging';

/** True when this process is the staging API. */
export function isStagingApi(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FLY_APP_NAME === STAGING_API_APP;
}

/** A surface's absolute URL, on the stack this API actually is.
 *
 *  Use this instead of calling `surfaceUrl(key, process.env)` directly from
 *  the API: that form is correct only while an env override exists, and this
 *  form is correct without one. The override still takes precedence, because
 *  `surfaceUrl` checks it first.
 *
 *  The host argument is a hostname on the staging apex, which is all
 *  `isStagingHost` looks at — it stands in for the request host this code
 *  does not have. */
export function stackSurfaceUrl(
  key: SurfaceKey,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return surfaceUrl(
    key,
    env as Record<string, string | undefined>,
    isStagingApi(env) ? 'api.thefibre.tech' : null,
  );
}
