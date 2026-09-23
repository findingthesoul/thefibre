// A person who exists must not be offered as a stranger, and pressing add
// must not make a second copy of them.
//
// Sjoerd, 2026-09-23: *"in fibre this person exist... but the TODAY meeting
// does not recognize it"*, and the cause in his own words — *"I added him
// before through this interface - I assumed it connected email."*
//
// The agenda matches attendees on ADDRESS, because an address is exact and a
// name is a guess. Since v0.95.0 a person can be created from a name alone,
// and those people have no address — so they are invisible to that match for
// ever, and pressing add on them would create a twin.
//
// The folding below is the rule both halves use to decide that a calendar
// name and a contact name are the same name. It is only ever used to OFFER.

import { describe, expect, it } from 'vitest';

/** Identical to foldName in apps/api/src/routes/connections-agenda.ts and to
 *  the one in the write-up's onCreate. Kept here as the thing under test. */
const fold = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

describe('when a calendar name is a name already on file', () => {
  it('matches across case and spacing', () => {
    expect(fold('Rense Bos')).toBe(fold('rense  bos'));
    expect(fold('Rense Bos')).toBe(fold('RENSE BOS'));
  });

  it('matches across the punctuation a calendar puts in a name', () => {
    // "Jimenez R.G.M. (Raquel)" is a real attendee name from his calendar.
    expect(fold('Jimenez R.G.M. (Raquel)')).toBe('jimenez r g m raquel');
    expect(fold('Jean-Paul Sartre')).toBe(fold('Jean Paul Sartre'));
  });

  it('does NOT match two different people', () => {
    expect(fold('Rense Bos')).not.toBe(fold('Rense Bosma'));
    expect(fold('Martine Verweij')).not.toBe(fold('Martin Verweij'));
  });

  it('is empty for an attendee the calendar gave no name for', () => {
    // Then there is nothing to offer, and the chip creates as it always did.
    expect(fold('')).toBe('');
    expect(fold('   ')).toBe('');
  });
});
