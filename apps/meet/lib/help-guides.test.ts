import { describe, expect, it } from 'vitest';
import { checkGuideLabels } from '@thefibre/shared/help-guide-labels';
import { LOCALES, t, UI_KEYS } from './i18n-ui';

// Do this app's help guides quote controls that still exist?
//
// A guide that tells somebody to press a button nobody can find is worse than
// no guide: they go looking, fail, and conclude the product is broken rather
// than the manual. The guide text and the button text are two strings in the
// same catalogue and nothing compared them until this.
//
// The rule lives in `@thefibre/shared/help-guide-labels` so every app checks
// the same thing. There is no list of which guide names which button — the
// guides name controls by quoting them, so the check reads the guides. A list
// is the thing that goes stale, which is the failure this exists to prevent.

// Quoted, but NOT controls — examples and partial phrases. Each locale's
// wording is its own entry, because the guides are translated and so are
// the examples; an exception covering only English would let five
// languages drift. Stale entries fail, so this cannot grow unnoticed.
const EXCEPTIONS: { phrase: string; why: string }[] = [
  // help_g_google_calendar_steps: the free/busy state a calendar shows, quoted as a word rather than as a control
  { phrase: 'vrij', why: 'the free/busy state a calendar shows, quoted as a word rather than as a control' },
];

describe('help guides quote controls that exist', () => {
  const report = checkGuideLabels({ locales: LOCALES, t, keys: UI_KEYS, exceptions: EXCEPTIONS });

  it('every quoted control is a string this app renders, in every locale', () => {
    expect(report.misses).toEqual([]);
  });

  it('carries no exception for a phrase no guide quotes any more', () => {
    // An exemption that outlives its reason is how a skip-list grows.
    expect(report.stale).toEqual([]);
  });

  it('quotes almost nothing, and that is recorded rather than passed over', () => {
    // This app's ENGLISH guides name controls without quoting them, so the
    // check above has nothing to compare and proves close to nothing here.
    // Exactly one phrase is quoted anywhere — a Dutch word, excepted above.
    //
    // Asserted rather than left implicit, so it cannot be mistaken for
    // coverage. The day somebody adopts the quoting convention in these
    // guides, this fails and the assertions above start doing real work.
    expect(report.perLocale.en).toBe(0);
    expect(report.quoted).toBeLessThan(3);
  });
});
