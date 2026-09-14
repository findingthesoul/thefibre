// The quoted `.or()` filter against the real PostgREST (testing approach §3.4):
// a unit test proves the string's shape; only the server proves the grammar
// accepts it. A search term full of filter syntax must return rows or no
// rows — never a 400 — and a wildcard in the term must match as text.
import { describe, expect, it } from 'vitest';
import { orIlike } from '../lib/postgrest-filter.js';
import { service } from './staging.js';

const HOSTILE = ['a,b)', 'x.is.null', 'O"Brien', '%', '_', 'name.eq.', '((()))', '\\'];

describe('orIlike against PostgREST', () => {
  for (const term of HOSTILE) {
    it(`accepts ${JSON.stringify(term)} as text`, async () => {
      const { error } = await service
        .from('person')
        .select('id')
        .or(orIlike(['first_name', 'last_name', 'email'], term))
        .limit(1);
      expect(error, error?.message).toBeNull();
    });
  }

  it('a lone % matches nothing rather than everything', async () => {
    const { data, error } = await service
      .from('person')
      .select('id')
      .or(orIlike(['first_name', 'last_name', 'email'], '%'))
      .limit(5);
    expect(error).toBeNull();
    // Only a name that literally contains a percent sign qualifies; staging
    // has none, and if one appears this assertion should be revisited rather
    // than the escaping.
    expect(data ?? []).toEqual([]);
  });
});
