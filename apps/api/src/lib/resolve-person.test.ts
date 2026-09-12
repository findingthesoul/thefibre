import { describe, it, expect } from 'vitest';
import { normaliseEmail, splitPersonName, isPersonSource } from './resolve-person.js';

// The pure halves of the person SPoT. These two functions decide whether two
// spellings of one address compare equal, and what lands in first_name /
// last_name — which is most of what "duplicate" means in practice.

describe('normaliseEmail', () => {
  it('lowercases, so two spellings of one address match', () => {
    expect(normaliseEmail('Marja.Bakker@Example.ORG')).toBe('marja.bakker@example.org');
  });

  it('trims surrounding whitespace', () => {
    expect(normaliseEmail('  marja@example.org \n')).toBe('marja@example.org');
  });

  it('strips the angle brackets that arrive from mail headers and calendar attendees', () => {
    // The calendar scanner and any BCC capture will hand us this shape.
    expect(normaliseEmail('<marja@example.org>')).toBe('marja@example.org');
    expect(normaliseEmail(' <Marja@Example.org> ')).toBe('marja@example.org');
  });

  it('returns null for absent or empty input rather than an empty string', () => {
    expect(normaliseEmail(null)).toBeNull();
    expect(normaliseEmail(undefined)).toBeNull();
    expect(normaliseEmail('')).toBeNull();
    expect(normaliseEmail('   ')).toBeNull();
    expect(normaliseEmail('<>')).toBeNull();
  });

  it('leaves an address containing an underscore intact', () => {
    // The bug this replaced: membership matched with .ilike(), where _ is a
    // single-character wildcard, so foo_bar@x.com could match fooXbar@x.com.
    // Normalisation must not "fix" the underscore away either.
    expect(normaliseEmail('foo_bar@example.org')).toBe('foo_bar@example.org');
  });

  it('leaves a percent sign intact', () => {
    expect(normaliseEmail('a%b@example.org')).toBe('a%b@example.org');
  });
});

describe('splitPersonName', () => {
  it('splits on the first space', () => {
    expect(splitPersonName('Marja Bakker')).toEqual({ first: 'Marja', last: 'Bakker' });
  });

  it('keeps every remaining part in the surname', () => {
    expect(splitPersonName('Daniel van der Berg')).toEqual({
      first: 'Daniel',
      last: 'van der Berg',
    });
  });

  it('writes null, never an empty string, for a single name', () => {
    // Two of the nine call sites wrote last_name: '' here and the rest wrote
    // null, which made the same person look different depending on which door
    // they came through.
    expect(splitPersonName('Marja')).toEqual({ first: 'Marja', last: null });
  });

  it('collapses runs of whitespace', () => {
    expect(splitPersonName('  Marja   Bakker  ')).toEqual({ first: 'Marja', last: 'Bakker' });
  });

  it('returns nulls for absent or empty input', () => {
    expect(splitPersonName(null)).toEqual({ first: null, last: null });
    expect(splitPersonName(undefined)).toEqual({ first: null, last: null });
    expect(splitPersonName('   ')).toEqual({ first: null, last: null });
  });
});

describe('isPersonSource', () => {
  it('accepts every value the column is meant to hold', () => {
    for (const s of [
      'manual',
      'meet_booking',
      'meet_invite',
      'thread_enrolment',
      'thread_participant',
      'member_invite',
      'membership_join',
      'membership_purchase',
      'app_link',
    ]) {
      expect(isPersonSource(s)).toBe(true);
    }
  });

  it('rejects anything else', () => {
    // created_via is deliberately a plain text column with no check
    // constraint — the vocabulary lives here, so this guard is the only
    // thing standing between a typo and a useless provenance record.
    expect(isPersonSource('meet-booking')).toBe(false);
    expect(isPersonSource('')).toBe(false);
    expect(isPersonSource(null)).toBe(false);
    expect(isPersonSource(undefined)).toBe(false);
    expect(isPersonSource(42)).toBe(false);
  });
});
