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

const EXCEPTIONS: { phrase: string; why: string }[] = [
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

  it('quotes NOTHING, and that is recorded rather than passed over', () => {
    // This app's guides name controls without quoting them, so the check
    // above has nothing to look at and proves nothing about this app. Stated
    // as an assertion so it cannot be mistaken for coverage: the day somebody
    // adopts the quoting convention here, this fails and the two assertions
    // above start doing real work.
    expect(report.quoted).toBe(0);
  });
});
