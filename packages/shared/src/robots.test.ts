// The asymmetry here is the whole point, so it is locked: only the literal
// string 'production' opens a site. Getting this wrong in the other
// direction de-indexes thethread.app, which takes weeks to recover.

import { describe, expect, it } from 'vitest';
import { isProductionDeployment, noindexHeader, robotsForEnvironment, robotsNeverIndex } from './robots.js';

describe('robotsForEnvironment', () => {
  it('opens ONLY on a production deployment', () => {
    expect(isProductionDeployment('production')).toBe(true);
    expect(robotsForEnvironment('production')).toEqual({ rules: { userAgent: '*', allow: '/' } });
  });

  // Changed deliberately on 2026-09-23: a KNOWN preview is now crawlable, so
  // the crawler can read the `noindex` header that actually removes it from
  // the index. Disallow stops the fetch, and a crawler that cannot fetch can
  // never read the instruction to drop the listing — which is how
  // thefibre.tech ended up in Google despite a robots.txt written to prevent
  // exactly that. The pairing is asserted below: crawlable AND noindex.
  it.each(['preview', 'development'])('opens a KNOWN preview to the crawler on %j', (env) => {
    expect(robotsForEnvironment(env)).toEqual({ rules: { userAgent: '*', allow: '/' } });
    // …and never without the header that makes it safe.
    expect(noindexHeader(env)).toEqual([{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]);
  });

  it.each(['', 'Production', 'prod', undefined])(
    'closes on an environment it cannot reason about: %j',
    (env) => {
      expect(robotsForEnvironment(env)).toEqual({ rules: { userAgent: '*', disallow: '/' } });
      expect(noindexHeader(env)).toHaveLength(1);
    },
  );

  it('closes when the variable is absent — a build outside Vercel', () => {
    expect(isProductionDeployment(undefined)).toBe(false);
    expect(robotsForEnvironment(undefined)).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });
});

describe('robotsNeverIndex', () => {
  it('closes even on production — the visitor portal', () => {
    expect(robotsNeverIndex()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });
});
