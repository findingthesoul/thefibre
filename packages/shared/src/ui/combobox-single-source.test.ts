// One picker, not one per surface.
//
// Sjoerd, 2026-09-22, watching Connect grow its own search box next to the
// one apps/web already had: *"There should be a Single Point of truth — it is
// existing somewhere else"*, and then *"Add company - also a single point of
// truth."* He was right both times. Connect had THREE hand-rolled pickers by
// then (the note composer's, the write-up's, the relationship card's) and the
// web app had the real one.
//
// This fails the release if a fourth is written. It looks for the shape of a
// hand-rolled type-ahead — a text input whose results are a list the file
// filters itself — in the apps that have been cleaned up.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../../..');

/** Cleaned up, and expected to stay that way. The other apps have their own
 *  pickers still; porting them is a build-plan entry, and listing them here
 *  before that work is done would fail the release for nobody's benefit. */
const SCANNED = ['apps/connections'];

/** The shared components a picker must be built from. */
const SHARED = /@thefibre\/shared\/ui\/(person-combobox|organisation-combobox|search-select)/;

describe('the person and organisation pickers', () => {
  it('are built from the shared components, never hand-rolled again', () => {
    const files = execFileSync('git', ['ls-files', '--', ...SCANNED.map((d) => `${d}/**/*.tsx`)], {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
    expect(files.length).toBeGreaterThan(20);

    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(resolve(ROOT, f), 'utf8');
      // A file that already uses the shared components is fine whatever else
      // it does.
      if (SHARED.test(src)) continue;
      // The tell of a hand-rolled one: it searches a list of people or
      // organisations it loaded, in response to typing.
      const typing = /onChange=\{\(e\) => set(Term|Query|Search)/.test(src);
      const filtering = /\.filter\(\([a-z]\) =>[^\n]*\.name\.toLowerCase\(\)\.includes/.test(src);
      if (typing && filtering) offenders.push(f);
    }
    // Import PersonCombobox or OrganisationCombobox from @thefibre/shared/ui
    // and give it this app's search, the way lib/person-picker.ts does.
    expect(offenders).toEqual([]);
  });
});
