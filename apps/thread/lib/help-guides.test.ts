import { describe, expect, it } from 'vitest';
import { checkGuideLabels } from '@thefibre/shared/help-guide-labels';
import { LOCALES } from '@thefibre/shared/i18n';
import { t, UI_KEYS } from './i18n-ui';

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
  // help_g_schedule_steps: an example of the warning text, with N standing in for a number
  { phrase: 'N changes not sent. N people have not been told.', why: 'an example of the warning text, with N standing in for a number' },
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

  it('quotes something at all', () => {
    // Guard against the vacuous pass: with nothing quoted, every assertion
    // above holds over an empty set.
    expect(report.quoted).toBeGreaterThan(0);
  });

  it('can see every locale, not just the ones it knows how to read', () => {
    // The first version of the shared check looked only for English curly
    // quotes, so German (low-9) and French (guillemets) yielded nothing and
    // passed in silence, hiding twelve real mismatches. A locale at zero
    // while English has several means the convention is one the check does
    // not know — not that the guides are clean.
    const en = report.perLocale.en ?? 0;
    for (const [locale, n] of Object.entries(report.perLocale)) {
      expect(n, `${locale} quotes nothing while en quotes ${en}`).toBeGreaterThan(0);
    }
  });
});
