import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// A site theme's name is written in FOUR places that have to agree:
//
//   1. the CHECK constraint on thread_settings.site_theme
//   2. the Zod enum on PATCH /thread/settings
//   3. SiteTheme in apps/api/src/lib/public-site.ts
//   4. SiteTheme in apps/thread/lib/public-site.ts   (+ the renderer registry)
//
// Every one of those alone compiles and passes review. Get them out of step
// and the failure is quiet in the worst direction: widen 2-4 but not 1 and
// the settings page offers a design, accepts the click, and the save returns
// a PostgREST 400 that the form reports as a generic failure — the choice
// simply will not stick, with nothing on screen saying why. Widen 1 only and
// nothing happens at all.
//
// So this compares the four lists as text. It is the shape of test that
// catches what exercising one side cannot: each half is correct about
// itself, and the feature is broken between them.

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel: string) => readFileSync(here(rel), 'utf8');

/** The last migration that (re)states the constraint wins — a later one may
 *  drop and re-add it, and reading only the original would assert history. */
function themesFromMigrations(): string[] {
  const dir = here('../../../../supabase/migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  let found: string[] | null = null;
  for (const f of files) {
    const sql = readFileSync(`${dir}/${f}`, 'utf8');
    const m = sql.match(/site_theme\s+in\s*\(([^)]*)\)/i);
    if (m) found = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  }
  if (!found) throw new Error('no migration states the site_theme check constraint');
  return found;
}

const fromList = (s: string) => [...s.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();

const db = themesFromMigrations().sort();

const zod = fromList(
  read('../routes/thread.ts').match(/site_theme:\s*z\.enum\(\[([^\]]*)\]\)/)![1],
);

const apiType = fromList(read('./public-site.ts').match(/export type SiteTheme =([^;]*);/)![1]);

const threadSrc = read('../../../thread/lib/public-site.ts');
const threadType = fromList(threadSrc.match(/export type SiteTheme =([^;]*);/)![1]);

const registry = read('../../../thread/app/[organiserSlug]/themes.tsx')
  .match(/export const THEMES = \{([\s\S]*?)\} as const;/)![1]
  .split('\n')
  .map((l) => l.match(/^\s*([a-z_]+):/)?.[1])
  .filter(Boolean)
  .sort() as string[];

describe('every list of site themes says the same thing', () => {
  it('the database constraint and the API validator agree', () => {
    expect(zod).toEqual(db);
  });

  it('the API type agrees', () => {
    expect(apiType).toEqual(db);
  });

  it("the Thread app's mirrored type agrees", () => {
    expect(threadType).toEqual(db);
  });

  it('every permitted theme has a renderer', () => {
    expect(registry).toEqual(db);
  });

  it('the settings page offers every one of them', () => {
    const form = read('../../../thread/app/(app)/settings/website/form.tsx');
    // Scoped to the THEMES array on purpose: the tab strip in the same file
    // is also a list of `{ value: '…' }`, and a looser pattern reported the
    // tabs as undeclared themes.
    const list = form.match(/const THEMES:[^=]*=\s*\[([\s\S]*?)\];/)![1];
    const offered = [...list.matchAll(/value:\s*'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(offered).toEqual(db);
  });

  it('plain is among them — it is the fallback for a row nothing can render', () => {
    expect(db).toContain('plain');
  });
});
