import { describe, expect, it } from 'vitest';
import { orIlike, orEq } from './postgrest-filter.js';

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

describe('orEq', () => {
  it('builds one quoted eq clause per pair', () => {
    expect(orEq([['person_id', 'abc'], ['payer_email', 'a@b.com']])).toBe(
      'person_id.eq."abc",payer_email.eq."a@b.com"',
    );
  });

  it('keeps commas, parens and dots inert inside the quotes', () => {
    expect(orEq([['payer_email', 'a,b).c']])).toBe('payer_email.eq."a,b).c"');
  });

  it('escapes a double quote and a backslash ONCE — there is no LIKE layer', () => {
    expect(orEq([['payer_email', 'o"b\\c']])).toBe('payer_email.eq."o\\"b\\\\c"');
  });

  it('never touches % or _, which mean nothing to eq', () => {
    expect(orEq([['payer_email', '100%_x@y.z']])).toBe('payer_email.eq."100%_x@y.z"');
  });
});
