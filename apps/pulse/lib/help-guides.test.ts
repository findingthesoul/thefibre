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
  // help_g_budget_steps: an example budget line, not a control
  { phrase: 'Office rent', why: 'an example budget line, not a control' },
  { phrase: 'Kantoorhuur', why: 'an example budget line, not a control' },
  { phrase: 'Alquiler de oficina', why: 'an example budget line, not a control' },
  { phrase: 'Aluguel do escritório', why: 'an example budget line, not a control' },
  { phrase: 'Büromiete', why: 'an example budget line, not a control' },
  { phrase: 'Loyer du bureau', why: 'an example budget line, not a control' },
  // help_g_income_steps: example rows and partial column words in the income walkthrough, not controls
  { phrase: 'Create …', why: 'example rows and partial column words in the income walkthrough, not controls' },
  { phrase: 'Website rebuild — phase 2', why: 'example rows and partial column words in the income walkthrough, not controls' },
  { phrase: 'Until', why: 'example rows and partial column words in the income walkthrough, not controls' },
  { phrase: 'Aanmaken …', why: 'example rows and partial column words in the income walkthrough, not controls' },
  { phrase: 'Website vernieuwing — fase 2', why: 'example rows and partial column words in the income walkthrough, not controls' },
  { phrase: 'Tot', why: 'example rows and partial column words in the income walkthrough, not controls' },
  { phrase: 'Crear …', why: 'example rows and partial column words in the income walkthrough, not controls' },
  { phrase: 'Rediseño web — fase 2', why: 'example rows and partial column words in the income walkthrough, not controls' },
  { phrase: 'Hasta', why: 'example rows and partial column words in the income walkthrough, not controls' },
  { phrase: 'Criar …', why: 'example rows and partial column words in the income walkthrough, not controls' },
  { phrase: 'Reforma do site — fase 2', why: 'example rows and partial column words in the income walkthrough, not controls' },
  { phrase: 'Até', why: 'example rows and partial column words in the income walkthrough, not controls' },
  { phrase: 'Anlegen …', why: 'example rows and partial column words in the income walkthrough, not controls' },
  { phrase: 'Website-Relaunch — Phase 2', why: 'example rows and partial column words in the income walkthrough, not controls' },
  { phrase: 'Bis', why: 'example rows and partial column words in the income walkthrough, not controls' },
  { phrase: 'Créer …', why: 'example rows and partial column words in the income walkthrough, not controls' },
  { phrase: 'Refonte du site — phase 2', why: 'example rows and partial column words in the income walkthrough, not controls' },
  { phrase: 'Jusqu’au', why: 'example rows and partial column words in the income walkthrough, not controls' },
  // help_g_invoice_steps: an example invoice-number prefix, not a control
  { phrase: '2026-', why: 'an example invoice-number prefix, not a control' },
  // help_g_reserve_steps: an example reserve name, not a control
  { phrase: 'VAT reserve', why: 'an example reserve name, not a control' },
  { phrase: 'Btw-reserve', why: 'an example reserve name, not a control' },
  { phrase: 'Reserva de IVA', why: 'an example reserve name, not a control' },
  { phrase: 'MwSt.-Rücklage', why: 'an example reserve name, not a control' },
  { phrase: 'Réserve TVA', why: 'an example reserve name, not a control' },
  // help_g_teams_steps: an example team name, not a control
  { phrase: 'Incubator Rotterdam', why: 'an example team name, not a control' },
  { phrase: 'Incubadora Rotterdam', why: 'an example team name, not a control' },
  { phrase: 'Incubadora Roterdã', why: 'an example team name, not a control' },
  { phrase: 'Inkubator Rotterdam', why: 'an example team name, not a control' },
  { phrase: 'Incubateur Rotterdam', why: 'an example team name, not a control' },
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
