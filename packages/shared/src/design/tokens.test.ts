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
import { fibrePreset } from './tailwind-preset.js';

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

// ── A token nobody can use is not a token ───────────────────────────────────
//
// The token list and the Tailwind colour map are two hand-written lists that
// have to agree, and nothing made them. Adding `booked` to TOKEN_NAMES on
// 2026-09-23 defined the CSS variable and produced no `bg-booked` class at
// all: the app compiled, the typecheck passed, and the fill simply did not
// happen. Exactly the shape this repo keeps shipping inert — each list valid
// on its own, no error anywhere.
describe('every token is reachable from Tailwind', () => {
  it('has a colour entry for each name in TOKEN_NAMES', () => {
    const colors = (fibrePreset.theme?.extend?.colors ?? {}) as Record<
      string,
      Record<string, string>
    >;
    // A token is either its own key (`save`) or a shade under a family
    // (`surface-sunken` → colors.surface.sunken), which is how Tailwind
    // composes `bg-surface-sunken`.
    const reachable = (token: string): boolean => {
      if (colors[token]?.DEFAULT) return true;
      const i = token.indexOf('-');
      if (i === -1) return false;
      return Boolean(colors[token.slice(0, i)]?.[token.slice(i + 1)]);
    };
    const missing = TOKEN_NAMES.filter((t) => !reachable(t));
    expect(missing, 'tokens with no Tailwind class').toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// A colour that does not EXIST (2026-10-11)
// ---------------------------------------------------------------------------
// The guard above stops an app ADDING a colour. Nothing stopped an app USING
// one that was never defined — and Tailwind is silent about it: an unknown
// class simply produces no rule, so `bg-ink-strong` rendered a TRANSPARENT
// button. On 2026-10-11 that shipped to staging as near-black text on a
// near-black page, measured at rgba(0,0,0,0) over rgb(13,15,18), with every
// test green and the markup reading perfectly. It was found by a person
// looking at a phone-sized screen, which is not a repeatable guard.
//
// `ink-strong` had been in the repo SIX times, including two buttons.
//
// This fails the release instead.
describe('every colour used is a colour that exists', () => {
  // Only the token-shaped ones. An app may legitimately say `text-red-700` or
  // `bg-white` — Tailwind's own palette is not the design system's business
  // here. What this catches is a name that LOOKS like one of ours (an
  // `ink-`/`surface-`/`line-` family member, or a bare role) and is not.
  const FAMILIES = ['ink', 'surface', 'line'];
  const known = new Set<string>(TOKEN_NAMES);

  /** Strip comments, so a line EXPLAINING a bad token is not read as using
   *  one — this file's own fix left exactly such comments behind. */
  function withoutComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, ''))
      .join('\n');
  }

  function* sourceFiles(dir: string): Generator<string> {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.next') continue;
      // The same exclusion the rest of this file uses: the marketing site has
      // its own light-only brand language and defines its own `surface-warm`
      // and `surface-paper` in its own tailwind.config.ts. Those are real
      // there and absent from TOKEN_NAMES by design, so scanning it would
      // report seven false alarms and teach the next person to ignore this
      // test — which is worse than not having it.
      if (dir === APPS_DIR && OWN_DESIGN.has(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) yield* sourceFiles(p);
      else if (/\.(tsx?|css)$/.test(e.name)) yield p;
    }
  }

  it('uses no bg-/text-/border- colour outside TOKEN_NAMES', () => {
    const bad: string[] = [];
    for (const root of [APPS_DIR, join(ROOT, 'packages')]) {
      for (const file of sourceFiles(root)) {
        const src = withoutComments(readFileSync(file, 'utf8'));
        // bg-ink-strong, text-surface-raised, border-line-strong, …
        for (const m of src.matchAll(/\b(?:bg|text|border|ring|fill|stroke|from|to|via)-([a-z]+(?:-[a-z]+)*)\b/g)) {
          const name = m[1]!;
          const family = name.split('-')[0]!;
          if (!FAMILIES.includes(family)) continue; // not ours to police
          if (known.has(name)) continue;
          bad.push(`${file.slice(ROOT.length + 1)}: ${m[0]}`);
        }
      }
    }
    expect(
      [...new Set(bad)],
      'these name a design token that does not exist, so Tailwind emits NO rule and the element renders with no colour at all',
    ).toEqual([]);
  });
});
