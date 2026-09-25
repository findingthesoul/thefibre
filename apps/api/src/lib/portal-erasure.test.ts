// The sentence somebody reads before giving up their account.
//
// These are pure-shape assertions on the message the portal builds from the
// picture — the counting itself is exercised against a real database, because
// a select is a string TypeScript never reads and one of these nine was wrong
// in exactly that way.

import { describe, expect, it } from 'vitest';
import { erasureNote } from './portal-erasure.js';

const picture = (over: Partial<Parameters<typeof erasureNote>[0]> = {}) => ({
  blocked: { upcoming_threads: 0, participants_affected: 0, workspaces: [] as string[] },
  kept: { invoices: 0 },
  reason: null as string | null,
  ...over,
});

describe('erasureNote', () => {
  it('says where the request came from, so nobody has to guess', () => {
    expect(erasureNote(picture())).toContain('visitor portal');
  });

  // The whole point of Sjoerd's question: whoever picks this up must not have
  // to re-derive that erasing this person removes other people's organiser.
  it('spells out what blocks it, with the numbers', () => {
    const note = erasureNote(
      picture({ blocked: { upcoming_threads: 2, participants_affected: 31, workspaces: ['EBBF'] } }),
    );
    expect(note).toContain('BLOCKED');
    expect(note).toContain('2');
    expect(note).toContain('31');
    expect(note).toMatch(/hand over or close/i);
  });

  it('records what is kept by law, and why', () => {
    const note = erasureNote(picture({ kept: { invoices: 4 } }));
    expect(note).toContain('4 invoice');
    expect(note).toContain('17(3)(b)');
  });

  it('carries the person’s own words when they gave any', () => {
    expect(erasureNote(picture({ reason: 'I never signed up for this.' }))).toContain(
      'I never signed up for this.',
    );
  });

  it('says nothing about blockers or invoices when there are none', () => {
    const note = erasureNote(picture());
    expect(note).not.toContain('BLOCKED');
    expect(note).not.toContain('invoice');
  });
});
