// Where a public page lives — the app's own origin, or the customer's own
// host when the owner has one verified (docs/domain-package.md, part 2).
//
// Every absolute public URL the API writes — Stripe success and cancel,
// the links in booking and enrolment mail, the calendar feed, payment
// links, the portal's thread links — used to be `appUrl(app)` plus a path.
// A customer on book.soul.com whose confirmation mail links to
// meet.thethread.app has the bug this fixes, discovered later and by them
// (Meet's chat, 2026-10-06). So the origin is asked here, per owner root.
//
// Only OWNER-ROOTED paths (`/{root}/…`) go through this. `/my`, `/invite`,
// `/certificate`, `/checkin` stay on the app's own origin: the tenant
// middleware sends the first two there anyway (they need the session
// cookie), and a verification URL printed on a certificate must be stable
// whatever a customer later does with their DNS.
//
// The web apps serve our own hosts unchanged, so a URL built here on the
// customer's host and one built on ours both work; the choice is only
// which one the customer's people see.

import { appUrl } from '@thefibre/shared';
import { adminClient } from '../db.js';
import { row } from './rows.js';
import type { WebApp } from './workspace-domain.js';

const TTL_MS = 60_000;
const cache = new Map<string, { until: number; origin: string | null }>();

/** `https://<verified customer host>` for this owner root in this app, or null. */
async function verifiedHostFor(app: WebApp, root: string): Promise<string | null> {
  const key = `${app}|${root}`;
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.until > now) return hit.origin;
  let origin: string | null = null;
  try {
    const r = row(
      'workspace_domain for origin',
      await adminClient
        .from('workspace_domain')
        .select('host')
        .eq('kind', 'web')
        .eq('status', 'verified')
        .eq('app', app)
        .eq('root_slug', root)
        .maybeSingle(),
    ) as { host: string } | null;
    origin = r ? `https://${r.host}` : null;
  } catch (e) {
    // A lookup failure must not break a payment redirect: our own origin
    // always works. Keep a stale positive if there is one.
    console.warn('[public-origin] lookup failed', app, root, e instanceof Error ? e.message : e);
    if (hit) return hit.origin;
  }
  cache.set(key, { until: now + TTL_MS, origin });
  return origin;
}

/**
 * The origin to put in front of `/{root}/…` for this app. No root, or no
 * verified host for it → the app's own origin (what `appUrl` says, env
 * override included, as before).
 */
export async function publicOriginFor(
  app: WebApp,
  root: string | null | undefined,
  /** What to use when the owner has no verified host — defaults to the
   *  app's own origin; the payment-link modules pass their `*_APP_URL`
   *  env override here so local dev keeps working as before. */
  fallback?: string | undefined,
): Promise<string> {
  const own = (fallback ?? appUrl(app, process.env)).replace(/\/$/, '');
  const slug = (root ?? '').trim().toLowerCase();
  if (!slug) return own;
  return (await verifiedHostFor(app, slug)) ?? own;
}

/**
 * The same for a LIST of owner roots at once — for the public thread list
 * and the participant's enrolment list, which are built in a synchronous
 * `.map` over many owners. One lookup per distinct root, then a Map the
 * callback reads from.
 */
export async function publicOriginsFor(app: WebApp, roots: Array<string | null | undefined>): Promise<Map<string, string>> {
  const distinct = [...new Set(roots.map((r) => (r ?? '').trim().toLowerCase()).filter(Boolean))];
  const pairs = await Promise.all(distinct.map(async (r) => [r, await publicOriginFor(app, r)] as const));
  return new Map(pairs);
}

/** For tests: forget everything. */
export function _clearPublicOriginCache(): void {
  cache.clear();
}
