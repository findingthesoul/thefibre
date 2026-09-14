import { describe, expect, it } from 'vitest';
import { orIlike } from './postgrest-filter.js';

describe('orIlike', () => {
  it('builds one quoted ilike clause per column', () => {
    expect(orIlike(['first_name', 'email'], 'marja')).toBe(
      'first_name.ilike."%marja%",email.ilike."%marja%"',
    );
  });

  it('keeps the grammar characters inert inside the quotes', () => {
    // A comma or a paren would otherwise start a new condition or close a
    // group — the injection the persons search carried until 2026-09-14.
    const s = orIlike(['name'], 'a,b).deleted-at.is.null');
    expect(s).toBe('name.ilike."%a,b).deleted-at.is.null%"');
  });

  it('escapes a double quote so the value cannot end early', () => {
    expect(orIlike(['name'], 'O"Brien')).toBe('name.ilike."%O\\"Brien%"');
  });

  it('matches LIKE wildcards as text', () => {
    // Doubled: PostgREST unquotes one layer, Postgres reads the other.
    expect(orIlike(['name'], '100%_done')).toBe('name.ilike."%100\\\\%\\\\_done%"');
    expect(orIlike(['name'], 'a\\b')).toBe('name.ilike."%a\\\\\\\\b%"');
  });
});
