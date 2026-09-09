// The asymmetry here is the whole point, so it is locked: only the literal
// string 'production' opens a site. Getting this wrong in the other
// direction de-indexes thethread.app, which takes weeks to recover.

import { describe, expect, it } from 'vitest';
import { isProductionDeployment, robotsForEnvironment, robotsNeverIndex } from './robots.js';

describe('robotsForEnvironment', () => {
  it('opens ONLY on a production deployment', () => {
    expect(isProductionDeployment('production')).toBe(true);
    expect(robotsForEnvironment('production')).toEqual({ rules: { userAgent: '*', allow: '/' } });
  });

  it.each(['preview', 'development', '', 'Production', 'prod'])(
    'closes on %j',
    (env) => {
      expect(robotsForEnvironment(env)).toEqual({ rules: { userAgent: '*', disallow: '/' } });
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
