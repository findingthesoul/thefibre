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

  // A DIFFERENT failure of the same rule, and the one that got past the test
  // above: not a hand-rolled type-ahead, but no search at all.
  //
  // The admin "first admin" fields were a plain <input type="email">. There
  // is no typing-and-filtering to detect, so widening SCANNED would not have
  // caught it — the tell is the absence of a picker where a PERSON is named.
  // Sjoerd, 2026-09-26: *"the forst admin field is not a single point of
  // truth field.. it does not search in the fibre..."*
  //
  // Narrow on purpose. It guards the two surfaces that name a person in the
  // admin area rather than pretending to a general rule about every input in
  // the product; a general one would need to know which inputs mean a person,
  // which is exactly what a reader can see and a regex cannot.
  it('every dialog that names a person by address uses the picker', () => {
    const field = readFileSync(
      resolve(ROOT, 'apps/web/components/ui/person-email-field.tsx'),
      'utf8',
    );
    expect(field).toMatch(/PersonCombobox/);

    // Settings → Members is the one people actually use, and it was the last
    // to be fixed — it is listed first here so it is the first thing a reader
    // sees this rule covering.
    for (const f of [
      'app/(app)/settings/members/invite-dialog.tsx',
      'app/(app)/admin/workspaces/first-admin-dialog.tsx',
      'app/(app)/admin/workspaces/new-workspace.tsx',
    ]) {
      const src = readFileSync(resolve(ROOT, `apps/web/${f}`), 'utf8');
      // Either the picker itself or the component built from it.
      expect(src, `${f} should name its person through the picker`).toMatch(
        /PersonEmailField|PersonCombobox/,
      );
      // And must not have gone back to asking for an address by hand —
      // either as a bare input or through the plain TextField, which is what
      // Settings → Members used.
      expect(src, `${f} should not take an email in a bare input`).not.toMatch(
        /<input[^>]*type="email"/,
      );
      expect(src, `${f} should not take an email in a plain TextField`).not.toMatch(
        /<TextField[^>]*\n?[^>]*type="email"/,
      );
    }
  });

});
