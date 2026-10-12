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
  // help_g_add_member_steps: the combobox option that inserts whatever was typed, so the label is partly the typed text
  { phrase: 'Create … as a new contact', why: 'the combobox option that inserts whatever was typed, so the label is partly the typed text' },
  { phrase: 'Maak … aan als nieuw contact', why: 'the combobox option that inserts whatever was typed, so the label is partly the typed text' },
  { phrase: 'Crear … como nuevo contacto', why: 'the combobox option that inserts whatever was typed, so the label is partly the typed text' },
  { phrase: 'Criar … como novo contato', why: 'the combobox option that inserts whatever was typed, so the label is partly the typed text' },
  { phrase: '… als neuen Kontakt anlegen', why: 'the combobox option that inserts whatever was typed, so the label is partly the typed text' },
  { phrase: 'Créer … comme nouveau contact', why: 'the combobox option that inserts whatever was typed, so the label is partly the typed text' },
  // help_g_tier_steps: an example tier price, not a control
  { phrase: 'Price on request', why: 'an example tier price, not a control' },
  { phrase: 'Prijs op aanvraag', why: 'an example tier price, not a control' },
  { phrase: 'Precio a consultar', why: 'an example tier price, not a control' },
  { phrase: 'Preço sob consulta', why: 'an example tier price, not a control' },
  { phrase: 'Preis auf Anfrage', why: 'an example tier price, not a control' },
  { phrase: 'Prix sur demande', why: 'an example tier price, not a control' },
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
