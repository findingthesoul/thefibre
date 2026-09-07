// The i18n mechanism (not the catalogs — those are guarded by the type
// system). makeT substitution and the toLocale fallback carry
// published-contract weight: public enrolment pages and emails render
// through them in six locales.

import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, LOCALES, isLocale, makeT, toLocale } from './i18n.js';

describe('toLocale / isLocale', () => {
  it('accepts every supported locale', () => {
    for (const l of LOCALES) {
      expect(isLocale(l)).toBe(true);
      expect(toLocale(l)).toBe(l);
    }
  });

  it('falls back to en for unknown, null and undefined', () => {
    expect(toLocale('xx')).toBe(DEFAULT_LOCALE);
    expect(toLocale(null)).toBe(DEFAULT_LOCALE);
    expect(toLocale(undefined)).toBe(DEFAULT_LOCALE);
  });
});

describe('makeT', () => {
  const t = makeT({
    greet: { en: 'Hello {name}', nl: 'Hallo {name}', es: 'Hola {name}', pt: 'Olá {name}', de: 'Hallo {name}', fr: 'Bonjour {name}' },
    spots: { en: '{n} of {n} left', nl: '{n} van {n} over', es: '{n} de {n}', pt: '{n} de {n}', de: '{n} von {n}', fr: '{n} sur {n}' },
  });

  it('substitutes placeholders, including repeats', () => {
    expect(t('en', 'greet', { name: 'Marja' })).toBe('Hello Marja');
    expect(t('en', 'spots', { n: 3 })).toBe('3 of 3 left');
  });

  it('unknown locale renders en', () => {
    expect(t('xx', 'greet', { name: 'M' })).toBe('Hello M');
    expect(t(null, 'greet', { name: 'M' })).toBe('Hello M');
  });

  it('numbers are stringified', () => {
    expect(t('nl', 'spots', { n: 0 })).toBe('0 van 0 over');
  });
});
