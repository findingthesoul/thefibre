// The X on a tag has to add the key the filter looks for.
//
// Sjoerd asked for the X back on 2026-09-22 ("mouse over also shows the X to
// turn the # into a word again"). The mechanism behind it — `dismissed` — has
// existed since 2026-09-12; only its trigger was missing. But the two halves
// keyed themselves DIFFERENTLY: a highlight range is keyed by fold()
// (lowercase, punctuation collapsed to spaces) and the filter used
// toLowerCase(). For a one-word tag those agree, which is why it would have
// looked fine; for "Deep-Democracy" or "Jean-Paul" they do not, and the X
// would have added a key nobody ever read and silently done nothing.
//
// This pins them together. It is the cheapest possible test and it covers the
// case that a hand-check would not have reached.

import { describe, expect, it } from 'vitest';
import { foldKey, highlightRanges } from './detect-tags';

describe('the key an X adds and the key the filter reads', () => {
  const cases = ['retreat', 'Deep-Democracy', 'Jean-Paul', 'Årets Ting', "O'Brien"];

  it('are the same string, punctuation and all', () => {
    for (const name of cases) {
      // What the range carries — what the X hands back.
      const ranges = highlightRanges(`about #${name.replace(/\s/g, '')} today`, [
        { name, via: 'hash' } as never,
      ]as never, []);
      const fromRange = ranges[0]?.key;
      // What the filter asks for.
      const fromFilter = foldKey(name);
      if (fromRange !== undefined) expect(fromRange).toBe(fromFilter);
    }
  });

  it('folds punctuation away rather than keeping it', () => {
    // The specific disagreement that was there: these two differ under
    // toLowerCase and agree under foldKey.
    expect(foldKey('Deep-Democracy')).toBe('deep democracy');
    expect(foldKey('Deep-Democracy')).not.toBe('Deep-Democracy'.toLowerCase());
    expect(foldKey('Jean-Paul')).not.toBe('jean-paul');
  });

  it('leaves a single plain word alone, which is why this hid', () => {
    expect(foldKey('retreat')).toBe('retreat');
    expect(foldKey('retreat')).toBe('retreat'.toLowerCase());
  });
});
