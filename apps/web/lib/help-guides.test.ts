import { describe, expect, it } from 'vitest';
import { checkGuideLabels } from '@thefibre/shared/help-guide-labels';
import { LOCALES, t, UI_KEYS } from './i18n-ui';

// Do this app's help guides quote controls that still exist?
//
// The first version of this file listed, by hand, which guide quoted which
// button — and only for the two duplicates guides. It found eighteen drifted
// labels on its first run, which was the argument for not stopping at two.
// The rule now comes from `@thefibre/shared/help-guide-labels` and applies to
// every guide here, with no list to keep: a guide names a control by quoting
// it, so the check reads the guides themselves.
//
// What it cannot see is a guide that names a control WITHOUT quoting it. The
// `quoted` count is asserted for exactly that reason — a check with nothing
// to check must say so rather than pass quietly.

// Phrases that are quoted but are NOT controls. Each locale's wording is its
// own entry, because the guides are translated and so are the examples — and
// an exception that only covers English would let five languages drift.
// Stale entries fail (see `stale`), so this list cannot quietly outgrow its
// reasons.
const HEADING = 'a section heading on the Assistant settings page, drawn by that page rather than from this catalogue';
const NO_ACCESS = 'describes the kind of page an app shows, not a control anybody presses';

const EXCEPTIONS = [
  { phrase: 'B. Your own Claude', why: HEADING },
  { phrase: 'B. Je eigen Claude', why: HEADING },
  { phrase: 'B. Tu propio Claude', why: HEADING },
  { phrase: 'B. Seu próprio Claude', why: HEADING },
  { phrase: 'B. Dein eigener Claude', why: HEADING },
  { phrase: 'B. Ton propre Claude', why: HEADING },
  { phrase: 'no access', why: NO_ACCESS },
  { phrase: 'geen toegang', why: NO_ACCESS },
  { phrase: 'sin acceso', why: NO_ACCESS },
  { phrase: 'sem acesso', why: NO_ACCESS },
  { phrase: 'Kein Zugriff', why: NO_ACCESS },
  { phrase: 'pas d’accès', why: NO_ACCESS },
];

describe('help guides quote controls that exist', () => {
  const report = checkGuideLabels({ locales: LOCALES, t, keys: UI_KEYS, exceptions: EXCEPTIONS });

  it('quotes something at all', () => {
    // Guard against the vacuous pass: if this app stopped quoting controls,
    // every assertion below would hold over an empty set.
    expect(report.quoted).toBeGreaterThan(0);
  });

  it('every quoted control is a string this app renders, in every locale', () => {
    expect(report.misses).toEqual([]);
  });

  it('carries no exception for a phrase no guide quotes any more', () => {
    // An exemption that outlives its reason is how a skip-list grows.
    expect(report.stale).toEqual([]);
  });

  it('can see every locale, not just the ones it knows how to read', () => {
    // The first version of this check looked only for English curly quotes,
    // so the German guides (low-9 quotes) and the French ones (guillemets)
    // yielded nothing and passed in silence. Twelve real mismatches were
    // hiding behind that. A locale at zero while English has several means
    // the quoting convention is one this check does not know — not that the
    // guides are clean.
    const en = report.perLocale.en ?? 0;
    for (const [locale, n] of Object.entries(report.perLocale)) {
      expect(n, `${locale} quotes nothing while en quotes ${en}`).toBeGreaterThan(0);
    }
  });
});
