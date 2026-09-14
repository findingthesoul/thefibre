import { describe, expect, it } from 'vitest';
import { randomSlugSuffix, slugify } from './slug.js';

describe('slugify', () => {
  it('lower-cases, hyphenates runs and trims the ends', () => {
    expect(slugify('  Festival of Trust — 2026!  ')).toBe('festival-of-trust-2026');
  });

  it('strips diacritics the way every app did', () => {
    expect(slugify('Café Müller & Søren')).toBe('cafe-muller-soren');
  });

  it('folds compatibility forms (NFKD), which the template copy did not', () => {
    expect(slugify('ﬁne ２０２６')).toBe('fine-2026');
  });

  it('caps at 60 characters and never ends on a hyphen after the cut', () => {
    const long = 'a'.repeat(59) + ' b';
    expect(slugify(long)).toHaveLength(59);
    expect(slugify(long).endsWith('-')).toBe(false);
    expect(slugify('x'.repeat(80))).toHaveLength(60);
  });

  it('returns an empty string for a name with nothing usable', () => {
    expect(slugify('!!! ???')).toBe('');
  });
});

describe('randomSlugSuffix', () => {
  it('is lower-case base-36 of the asked length', () => {
    for (let i = 0; i < 20; i++) expect(randomSlugSuffix()).toMatch(/^[a-z0-9]{4}$/);
    expect(randomSlugSuffix(6)).toMatch(/^[a-z0-9]{6}$/);
  });
});
