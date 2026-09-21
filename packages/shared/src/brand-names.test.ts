// One app, one name, in every place that spells it out.
//
// Sjoerd renamed this app twice: "Fibre Sales" → "Connections" (2026-09-13,
// because Sales named one axis of five) and "Connections" → "Connect"
// (2026-09-21). A rename is therefore a thing that HAPPENS here, not a
// one-off, and the way it goes wrong is always the same — the sidebar says
// the new name while the home-screen icon, a profile tab or the plan matrix
// still says the old one, and nobody notices because nothing fails.
//
// branding.ts is the source. Most surfaces read it. The ones below cannot:
// a JSON manifest has no imports, and the two web registries are plain data
// read by server components. So they are checked instead.
//
// This does NOT check every mention of the word. "Connections" is also the
// name of a settings page (your calendar and your meeting room) in every app,
// which is a different thing that keeps its name — and a test that could not
// tell those apart would be a test nobody could keep green.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APPS } from './branding.js';

const ROOT = resolve(import.meta.dirname, '../../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

describe('the name of an app is written once', () => {
  const brand = APPS['fibre-sales'];

  it('is what its published manifest announces', () => {
    const manifest = JSON.parse(read('apps/connections/fibre.app.json'));
    expect(manifest.app_name).toBe(brand.name);
    // And the slug in that same file is the thing that must NEVER move: it
    // tags every curator row and is in the published /api/v1/apps/* contract.
    expect(manifest.app_slug).toBe('fibre-sales');
  });

  it('is what the profile tab in The Fibre is called', () => {
    // apps/web/lib/apps.ts is plain data, read by server components; it
    // cannot import from here without pulling a client module into that
    // graph, so the label is spelled out there and checked here.
    const src = read('apps/web/lib/apps.ts');
    const entry = src.slice(src.indexOf("slug: 'fibre-sales'"));
    const label = entry.match(/label: '([^']+)'/)?.[1];
    expect(label).toBe(brand.name);
  });

  it('is what the plan matrix calls its section', () => {
    const src = read('apps/web/lib/plans.ts');
    const label = src.match(/app: '([^']+)',\n\s*\/\/[\s\S]*?rows: \[\{ key: 'connections'/)?.[1];
    expect(label).toBe(brand.name);
  });

  it('is the name the app says when you are leaving it', () => {
    const src = read('apps/connections/lib/i18n-ui.ts');
    const block = src.slice(src.indexOf('leave_title: {'), src.indexOf('leave_body: {'));
    // Every locale names the app; none of them may still name the old one.
    expect(block).toContain(brand.name);
    expect(block.split('\n').filter((l) => /en:|nl:/.test(l)).every((l) => l.includes(brand.name)))
      .toBe(true);
  });

  it('is not typed out on the sign-in page, which is read before anything else', () => {
    // This one was missed by the rename and shipped saying the old name on
    // the page a new person meets first. The fix was to interpolate from
    // branding; the guard is that the interpolation is still there.
    const src = read('apps/connections/app/page.tsx');
    const intro = src.slice(src.indexOf('intro='), src.indexOf('features='));
    expect(intro).toContain("${APPS['fibre-sales'].name}");
    // And no retired name survives anywhere in the prose on that page. Each
    // rename adds a line here; they are historical facts, not a list that
    // can go stale.
    for (const retired of ['Fibre Sales', 'Connections']) {
      const prose = src.slice(src.indexOf('<AppLanding'));
      expect(prose.includes(`. ${retired} `) || prose.includes(`>${retired}<`)).toBe(false);
    }
  });

  it('keeps the slug and the directory whatever the name is', () => {
    // The two things a rename may not touch, asserted so a future rename
    // reads this line before reaching for them.
    expect(Object.keys(APPS)).toContain('fibre-sales');
    expect(() => read('apps/connections/package.json')).not.toThrow();
  });
});
