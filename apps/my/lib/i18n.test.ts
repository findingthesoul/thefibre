import { describe, expect, it } from 'vitest';
import { SURFACES } from '@thefibre/shared';
import { LOCALES } from '@thefibre/shared/i18n';
import { MY_CATALOG, t } from './i18n';

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('the my.thread catalog', () => {
  // A translator who drops or renames a {placeholder} produces a sentence
  // that shows "{n}" to a reader, or loses the link out of it. The type
  // checker sees only that the string exists.
  it('has the same placeholders in every language', () => {
    const wrong: string[] = [];
    for (const [key, entry] of Object.entries(MY_CATALOG)) {
      const want = vars(entry.en).join(',');
      for (const l of LOCALES) {
        if (vars(entry[l]).join(',') !== want) wrong.push(`${key}.${l}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('says the same tagline in English as the registry other menus read', () => {
    expect(t('en', 'tagline')).toBe(SURFACES['my-portal'].tagline);
  });

  it('substitutes, and falls back to English for a locale it does not know', () => {
    expect(t('nl', 'earlier', { n: 3 })).toBe('Eerder (3)');
    expect(t('xx', 'earlier', { n: 3 })).toBe('Earlier (3)');
  });
});
