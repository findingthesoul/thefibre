// What crawlers are told, decided once for eight apps.
//
// Why this exists: on 2026-09-09 the staging stack was found to be publicly
// reachable AND fully indexable — six .tech subdomains serving a complete
// copy of the product with nothing telling a crawler to stay away, and no
// robots file anywhere in the repo. A staging copy in a search index
// competes with the real site and confuses real people.
//
// Deliberately conservative in one direction: the ONLY thing that opens a
// site to crawlers is VERCEL_ENV === 'production'. Anything else — preview,
// development, a missing variable, a build outside Vercel — closes it. The
// asymmetry is on purpose. A staging site that gets indexed is a nuisance;
// a production site accidentally de-indexed is lost revenue that takes
// weeks to recover, so "unknown" must never mean "index me".

// The environment is passed IN rather than read here. packages/shared is
// bundled into eight browser builds and carries no node types on purpose, so
// it decides WHAT the policy is and the caller supplies the fact — the same
// split the invoice model uses. Callers pass process.env.VERCEL_ENV.

/** Vercel sets VERCEL_ENV to 'production' | 'preview' | 'development'. */
export function isProductionDeployment(vercelEnv: string | undefined): boolean {
  return vercelEnv === 'production';
}

/** The shape Next's `app/robots.ts` returns (MetadataRoute.Robots), typed
 *  structurally so @thefibre/shared keeps zero dependencies. */
export type RobotsRules = {
  rules: { userAgent: string; allow?: string; disallow?: string };
};

const OPEN: RobotsRules = { rules: { userAgent: '*', allow: '/' } };
const CLOSED: RobotsRules = { rules: { userAgent: '*', disallow: '/' } };

/**
 * For an ordinary app: open on the production deployment, closed everywhere
 * else. Use from `app/robots.ts`:
 *
 *   import { robotsForEnvironment } from '@thefibre/shared/robots';
 *   export default function robots() {
 *     return robotsForEnvironment(process.env.VERCEL_ENV);
 *   }
 */
export function robotsForEnvironment(vercelEnv: string | undefined): RobotsRules {
  if (isProductionDeployment(vercelEnv)) return OPEN;
  // A KNOWN non-production deployment is crawlable ON PURPOSE. See
  // noindexHeader() for why: `Disallow` stops the fetch, and a crawler that
  // cannot fetch the page can never read the `noindex` that removes it.
  // Unknown still closes — the asymmetry above is unchanged.
  return isKnownPreview(vercelEnv) ? OPEN : CLOSED;
}

/** 'preview' and 'development' are Vercel's own values; anything else,
 *  including absent, is an environment we cannot reason about. */
export function isKnownPreview(vercelEnv: string | undefined): boolean {
  return vercelEnv === 'preview' || vercelEnv === 'development';
}

/**
 * `X-Robots-Tag: noindex` for every non-production response — the header that
 * actually keeps staging out of a search index.
 *
 * Sjoerd, 2026-09-23: *"Somehow Google can find https://thefibre.tech... can
 * we prevent it from finding it?"* — and the surprise is that the robots.txt
 * written on 2026-09-09 to prevent exactly this is what allowed it.
 *
 * `Disallow: /` forbids the FETCH, not the LISTING. Find the URL in a link
 * anywhere and Google may list it with no description — and because it is
 * forbidden to fetch the page, it can never see an instruction to drop it.
 * The listing is then permanent by construction.
 *
 * `noindex` is the instruction that removes it, and it can only be obeyed by
 * a crawler allowed to read it. So a known preview says "come in, and do not
 * index" — belt and braces the right way round. The file itself already knew
 * this distinction; it is written in robotsNeverIndex(): *this stops the
 * crawl, that stops the listing.* It had simply never been applied to staging.
 *
 * Returns [] on production, so this can be added unconditionally.
 */
export function noindexHeader(vercelEnv: string | undefined): { key: string; value: string }[] {
  return isProductionDeployment(vercelEnv)
    ? []
    : [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
}

/**
 * For a surface that must never be indexed anywhere, production included —
 * the visitor portal, whose every page below the sign-in is one person's own
 * tickets and memberships. Pairs with the `robots` metadata in its layout:
 * this stops the crawl, that stops the listing.
 */
export function robotsNeverIndex(): RobotsRules {
  return CLOSED;
}
