import { describe, it, expect } from 'vitest';
import { showsEnvironmentBar, ENVIRONMENT_BAR_CLASS } from './environment-bar.js';

describe('showsEnvironmentBar', () => {
  // The assertion the whole feature rests on. A blue line across production
  // would make the real product look broken, and nobody would be looking for
  // it there — so this is the case that must never regress.
  it('is FALSE on a production deployment', () => {
    expect(showsEnvironmentBar('production')).toBe(false);
  });

  it('is true on staging — a Vercel preview deployment', () => {
    expect(showsEnvironmentBar('preview')).toBe(true);
  });

  it('is true on a local dev server and when the variable is missing', () => {
    // Both are "not production", which is the whole claim the bar makes.
    expect(showsEnvironmentBar('development')).toBe(true);
    expect(showsEnvironmentBar(undefined)).toBe(true);
  });

  it('is not silenced by a value that merely looks like production', () => {
    // Vercel sets exactly 'production'. Anything else is something else, and
    // treating a near-miss as production would hide the bar on a stack that
    // is not it — failing in the direction that matters.
    for (const near of ['Production', 'PRODUCTION', 'prod', 'production ', ' production', '']) {
      expect(showsEnvironmentBar(near), JSON.stringify(near)).toBe(true);
    }
  });
});

describe('the bar itself', () => {
  it('is 5px and pinned to the very top', () => {
    expect(ENVIRONMENT_BAR_CLASS).toContain('h-[5px]');
    expect(ENVIRONMENT_BAR_CLASS).toContain('fixed');
    expect(ENVIRONMENT_BAR_CLASS).toContain('top-0');
    expect(ENVIRONMENT_BAR_CLASS).toContain('inset-x-0');
  });

  it('cannot swallow a click', () => {
    // It overlays the top 5px of every page in nine apps. Without this it
    // would eat the top edge of whatever sits beneath it.
    expect(ENVIRONMENT_BAR_CLASS).toContain('pointer-events-none');
  });

  it('takes its colour from the design token, never a typed value', () => {
    // docs/brand-design.md is binding: no app and no shared component types a
    // colour. `staging` is a role token in design/tokens.ts.
    expect(ENVIRONMENT_BAR_CLASS).toContain('bg-staging');
    expect(ENVIRONMENT_BAR_CLASS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(ENVIRONMENT_BAR_CLASS).not.toMatch(/\brgb\(/);
    expect(ENVIRONMENT_BAR_CLASS).not.toMatch(/\b(blue|sky|indigo)-\d/);
  });
});
