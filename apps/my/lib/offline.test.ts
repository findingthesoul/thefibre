import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '@thefibre/shared/i18n';
import { MY_CATALOG } from './i18n';

// public/offline.html is precached static HTML: it cannot import the catalog,
// so it carries a copy of the keys it shows. This holds the copy to the
// catalog — a word changed in one place and not the other fails here, not on
// a phone at a door with no signal.

const html = readFileSync(new URL('../public/offline.html', import.meta.url), 'utf8');
const json = html.match(/<script type="application\/json" id="strings">([\s\S]*?)<\/script>/)?.[1];
const copy = JSON.parse(json ?? '{}') as Record<string, Record<string, string>>;
const catalog = MY_CATALOG as Record<string, Record<string, string>>;

describe('the offline page', () => {
  it('carries all six languages', () => {
    expect(Object.keys(copy).sort()).toEqual([...LOCALES].sort());
  });

  it('says exactly what the catalog says, key by key', () => {
    const wrong: string[] = [];
    for (const l of LOCALES) {
      for (const [k, v] of Object.entries(copy[l] ?? {})) {
        if (catalog[k]?.[l] !== v) wrong.push(`${l}.${k}`);
      }
    }
    expect(wrong).toEqual([]);
    expect(Object.keys(copy.en ?? {}).length).toBeGreaterThan(8);
  });

  it('keeps English in the markup, for when the script cannot run', () => {
    expect(html).toContain('<h1 id="h1">You’re offline</h1>');
    expect(html).toContain('>Try again</button>');
  });
});
