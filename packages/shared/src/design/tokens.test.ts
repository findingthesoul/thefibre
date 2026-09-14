// The guard that keeps the design single-sourced (docs/brand-design.md).
//
// A rule in a document did not stop the palette being copied into nine apps
// and drifting into two; a failing test will stop the tenth. This reads every
// in-family app's tailwind.config.ts and globals.css from the repo and fails
// when one of them starts defining colours again.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DARK, LIGHT, TOKEN_NAMES, cssVariables } from './tokens.js';

const ROOT = resolve(import.meta.dirname, '../../../..');
const APPS_DIR = join(ROOT, 'apps');

/** The marketing site has its own light-only brand language on purpose and
 *  does not use the preset. Documented in docs/brand-design.md. */
const OWN_DESIGN = new Set(['website', 'api']);

/** Apps allowed ONE light-mode override block, pending Sjoerd's decision on
 *  unifying the palettes. Documented in docs/brand-design.md. */
const SLATE = new Set(['connections', 'flow', 'pulse']);

const inFamily = readdirSync(APPS_DIR).filter(
  (a) => !OWN_DESIGN.has(a) && existsSync(join(APPS_DIR, a, 'tailwind.config.ts')),
);

describe('the palette', () => {
  it('names a value for every token in both modes', () => {
    for (const n of TOKEN_NAMES) {
      expect(LIGHT[n], `LIGHT.${n}`).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
      expect(DARK[n], `DARK.${n}`).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
    }
  });

  it('turns into one CSS variable per token', () => {
    expect(Object.keys(cssVariables(LIGHT))).toEqual(TOKEN_NAMES.map((n) => `--${n}`));
  });
});

describe('every in-family app takes the design from the preset', () => {
  it('finds the apps it is guarding', () => {
    // If this drops, the glob stopped seeing the apps and every test below
    // would pass vacuously.
    expect(inFamily.length).toBeGreaterThanOrEqual(8);
  });

  for (const app of inFamily) {
    it(`${app}: tailwind.config.ts uses fibrePreset and defines no colours`, () => {
      const cfg = readFileSync(join(APPS_DIR, app, 'tailwind.config.ts'), 'utf8');
      expect(cfg).toMatch(/presets:\s*\[\s*fibrePreset/);
      expect(cfg, 'add a role to packages/shared/src/design/tokens.ts instead').not.toMatch(
        /\bcolors\s*:/,
      );
    });

    it(`${app}: globals.css holds no colour values of its own`, () => {
      const css = readFileSync(join(APPS_DIR, app, 'app/globals.css'), 'utf8').replace(
        /\/\*[\s\S]*?\*\//g,
        '',
      );
      const declared = [...css.matchAll(/(--[a-z-]+)\s*:/g)].map((m) => m[1]);
      if (!SLATE.has(app)) {
        expect(declared, 'colours belong in the preset').toEqual([]);
        return;
      }
      // The one allowed override: light mode only, and only existing tokens.
      expect(css).not.toMatch(/\.dark\s*\{/);
      for (const d of declared) {
        expect(TOKEN_NAMES.map((n) => `--${n}`), `${d} is not a token`).toContain(d);
      }
    });
  }
});
