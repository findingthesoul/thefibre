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

// A theme is also a place a bio can go missing. Each of the six renderers
// lays the bio out its own way, so the markup is six near-copies — and a
// seventh theme gets written by copying one of them. Reviewing six blocks by
// hand already nearly went wrong once: a pass that converted five of them
// would have left one theme rendering no bio at all, invisible until an
// organiser happened to select that design. So this asserts the property
// rather than a count — whatever is in the registry renders the bio, and does
// it through the one helper that knows plain text from HTML.
describe('every theme renders the organiser bio', () => {
  const src = read('../../../thread/app/[organiserSlug]/themes.tsx');

  /** The registry maps a theme name to a component; find that component's
   *  body by slicing from its declaration to the next top-level export. */
  const bodyOf = (component: string): string => {
    const start = src.indexOf(`export function ${component}(`);
    if (start < 0) throw new Error(`${component} is in the registry but not declared`);
    const rest = src.slice(start + 1);
    const next = rest.search(/\nexport (function|const) /);
    return next < 0 ? rest : rest.slice(0, next);
  };

  const components = Object.fromEntries(
    src
      .match(/export const THEMES = \{([\s\S]*?)\} as const;/)![1]
      .split('\n')
      .map((l) => l.match(/^\s*([a-z_]+):\s*([A-Za-z]+)\s*,/))
      .filter(Boolean)
      .map((m) => [m![1], m![2]]),
  );

  it('the registry maps every theme to a component we can find', () => {
    expect(Object.keys(components).sort()).toEqual(db);
  });

  for (const theme of Object.keys(components)) {
    it(`${theme} renders it, through bioToHtml`, () => {
      const body = bodyOf(components[theme]);
      // Not "mentions the bio somewhere": a renderer that interpolates the
      // bio straight into JSX is the bug — it prints tags as characters the
      // moment a bio is HTML. It has to go through the markup field.
      expect(body).toContain('p.bioHtml');
      expect(body).not.toMatch(/\{p\.bio\}/);
    });
  }
});
