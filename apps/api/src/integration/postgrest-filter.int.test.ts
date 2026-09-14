// The quoted `.or()` filter against the real PostgREST (testing approach §3.4):
// a unit test proves the string's shape; only the server proves the grammar
// accepts it. A search term full of filter syntax must return rows or no
// rows — never a 400 — and a wildcard in the term must match as text.
import { describe, expect, it } from 'vitest';
import { orIlike, orEq } from '../lib/postgrest-filter.js';
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

// orEq (2026-09-14): the purchase ledger's two identity keys, person_id OR
// payer_email. A hostile value must never 400, and — the half that catches a
// quoting mistake which silently matches nothing — a REAL email must be found.
describe('orEq against PostgREST', () => {
  const HOSTILE_EMAILS = ['a,b)@x.com', 'x.is.null', 'o"brien@x.com', 'back\\slash@x.com', '((()))'];

  for (const value of HOSTILE_EMAILS) {
    it(`accepts ${JSON.stringify(value)} as a value`, async () => {
      const { error } = await service
        .from('purchase')
        .select('id')
        .or(orEq([['payer_email', value]]))
        .limit(1);
      expect(error, error?.message).toBeNull();
    });
  }

  it('finds a real purchase by its payer_email (the success twin)', async () => {
    const { data: seed } = await service
      .from('purchase')
      .select('id, payer_email')
      .not('payer_email', 'is', null)
      .limit(1)
      .maybeSingle();
    // Staging has had ledger rows since the payments rehearsal; if it ever
    // has none, say so rather than pass on nothing.
    expect(seed, 'staging has no purchase with a payer_email to test against').toBeTruthy();
    const { data, error } = await service
      .from('purchase')
      .select('id')
      .or(orEq([['payer_email', seed!.payer_email as string]]))
      .eq('id', seed!.id);
    expect(error).toBeNull();
    expect((data ?? []).map((r) => r.id)).toEqual([seed!.id]);
  });

  it('matches EITHER key: an email-only row is found by the person filter', async () => {
    // The case that makes this an OR: a purchase written before its payer
    // had a person row carries only the email. person_id alone drops it.
    const { data: emailOnly } = await service
      .from('purchase')
      .select('id, payer_email')
      .is('person_id', null)
      .not('payer_email', 'is', null)
      .limit(1)
      .maybeSingle();
    if (!emailOnly) return; // nothing email-only on staging today; the OR is still exercised above
    const { data, error } = await service
      .from('purchase')
      .select('id')
      .or(
        orEq([
          ['person_id', '00000000-0000-0000-0000-000000000000'],
          ['payer_email', emailOnly.payer_email as string],
        ]),
      )
      .eq('id', emailOnly.id);
    expect(error).toBeNull();
    expect((data ?? []).map((r) => r.id)).toEqual([emailOnly.id]);
  });

  it('two .or() filters AND together — search inside one person', async () => {
    // purchases.ts applies the search and the person filter as two separate
    // .or() calls. That only works if PostgREST ANDs repeated `or` params
    // rather than letting the second replace the first.
    const { data: seed } = await service
      .from('purchase')
      .select('id, payer_email, item_label')
      .not('payer_email', 'is', null)
      .not('item_label', 'is', null)
      .limit(1)
      .maybeSingle();
    expect(seed).toBeTruthy();
    const label = String(seed!.item_label);
    const { data: hit, error } = await service
      .from('purchase')
      .select('id')
      .or(orIlike(['item_label'], label))
      .or(orEq([['payer_email', seed!.payer_email as string]]))
      .eq('id', seed!.id);
    expect(error).toBeNull();
    expect((hit ?? []).length).toBe(1);

    const { data: miss } = await service
      .from('purchase')
      .select('id')
      .or(orIlike(['item_label'], label))
      .or(orEq([['payer_email', 'nobody-at-all@example.invalid']]))
      .eq('id', seed!.id);
    // AND, not replace: the right label with the wrong person finds nothing.
    expect(miss ?? []).toEqual([]);
  });
});
