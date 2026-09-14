import { describe, it, expect } from 'vitest';
import { normaliseSearch } from './organisations.js';

// The search term has to be stripped exactly as search_names is stored
// (20260914191000), or the match fails silently. These are the shapes that
// failed, or would have.
describe('normaliseSearch', () => {
  it('drops accents — "bahá" meets "baha"', () => {
    expect(normaliseSearch('Bahá')).toBe('baha');
  });

  it('drops apostrophes, straight and typographic, so "Bahá\'í" meets "bahai"', () => {
    expect(normaliseSearch("Bahá'í")).toBe('bahai');
    expect(normaliseSearch('Bahá’í')).toBe('bahai');
    expect(normaliseSearch('Baháʼí')).toBe('bahai');
  });

  it('lower-cases, since search_names is stored lower-case', () => {
    expect(normaliseSearch('EBBF')).toBe('ebbf');
  });

  it('rewrites the letters NFD leaves alone, matching Postgres unaccent', () => {
    expect(normaliseSearch('Søren')).toBe('soren');
    expect(normaliseSearch('Straße')).toBe('strasse');
    expect(normaliseSearch('Æble')).toBe('aeble');
  });

  it('keeps ordinary words, spaces and digits intact', () => {
    expect(normaliseSearch('Ethical Business 2026')).toBe('ethical business 2026');
  });

  it('trims, and returns empty for a term that is only punctuation', () => {
    expect(normaliseSearch("  '  ")).toBe('');
  });
});
