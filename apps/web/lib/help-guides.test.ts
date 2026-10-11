import { describe, expect, it } from 'vitest';
import { LOCALES, t, type Locale, type UiKey } from './i18n-ui';

// A help guide that names a button nobody can find is worse than no guide.
//
// help/page.tsx has carried the instruction for a year — "Every button named
// exists on the page the guide links to — check the screen before editing a
// step" — and on 2026-10-12 the contacts duplicates guide was telling people
// to press "Keep this one" while the button said "Merge into this one", in
// all six locales. Nothing caught it, because the guide text and the button
// text are two strings in the same file that nothing compares.
//
// Nothing here looks at a screen, so it cannot prove a button is rendered.
// What it proves is narrower and is the half that went wrong: when a guide
// quotes a control, it quotes the CURRENT label for it, in every locale.
// Rename a button and the guide that quotes it fails until it is rewritten.

/** Controls a guide quotes, by the catalog key that supplies the label. */
const QUOTED: Record<string, UiKey[]> = {
  // Contacts → Duplicates.
  help_g_duplicates_steps: [
    'dup_find',
    'dup_same_person',
    'dup_different_people',
    'dup_keep_this',
    'dup_conflict_merge',
    'dup_recent_merges',
    'dup_undo',
    'dup_back',
  ],
  // Organisations → Duplicates. Shares the merge vocabulary with the person
  // queue and has its own question, which is the whole reason odup_* exists.
  help_g_org_duplicates_steps: [
    'dup_find',
    'odup_same_org',
    'odup_different_orgs',
    'dup_keep_this',
    'dup_conflict_merge',
    'dup_recent_merges',
    'dup_undo',
    'dup_back',
  ],
};

describe('help guides quote the labels the buttons actually carry', () => {
  for (const [guideKey, controls] of Object.entries(QUOTED)) {
    for (const locale of LOCALES) {
      it(`${guideKey} (${locale})`, () => {
        const steps = t(locale as Locale, guideKey as UiKey);

        // Guard against the vacuous version of this test: a missing or empty
        // guide would satisfy nothing-is-wrong while containing no labels at
        // all. Assert there is real text first.
        expect(steps.length).toBeGreaterThan(200);

        // Collect EVERY mismatch rather than throwing on the first. A guide
        // that quotes six controls and has three wrong should say so once —
        // fixing them one failure per run is how a short job becomes a long
        // one, and how a correct label gets "fixed" into a wrong one on the
        // way past.
        const missing = controls
          .map((control) => ({ control, label: t(locale as Locale, control) }))
          .filter(({ label }) => !steps.includes(label));

        expect(
          missing.map(({ control, label }) => `${control} → “${label}”`),
          `guide ${guideKey} (${locale}) quotes labels that no longer exist`,
        ).toEqual([]);
      });
    }
  }
});
