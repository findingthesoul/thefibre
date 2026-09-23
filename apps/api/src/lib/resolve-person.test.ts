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

// ── Names that arrive backwards from a calendar ─────────────────────────────
//
// Sjoerd, 2026-09-23: *"When you add people from calendar to fibre, you twist
// first and last name often..."* Real examples from his own invitations.
describe('splitPersonName — directory forms', () => {
  it('reads the Dutch directory form: surname, initials, given name', () => {
    // The case on screen when he reported it.
    expect(splitPersonName('Jimenez R.G.M. (Raquel)')).toEqual({
      first: 'Raquel',
      last: 'Jimenez',
    });
    // The initials go: they are a formality the person does not use, and
    // gluing them to the surname makes "Jimenez R.G.M." a name nobody has.
    expect(splitPersonName('Bakker J.W. (Jan)')).toEqual({ first: 'Jan', last: 'Bakker' });
    // A surname with a particle survives whole.
    expect(splitPersonName('van der Waal W. (Wilkemieke)')).toEqual({
      first: 'Wilkemieke',
      last: 'van der Waal',
    });
  });

  it('reads "Last, First"', () => {
    expect(splitPersonName('Verweij, Martine')).toEqual({ first: 'Martine', last: 'Verweij' });
    expect(splitPersonName('van der Berg, Daniel')).toEqual({
      first: 'Daniel',
      last: 'van der Berg',
    });
    expect(splitPersonName('Jimenez R.G.M., Raquel')).toEqual({
      first: 'Raquel',
      last: 'Jimenez',
    });
  });

  it('does NOT treat a bracketed acronym or place as a first name', () => {
    // The dangerous direction: putting "SDL" in somebody's first-name field
    // is worse than the bug this fixes, so the bracket rule is narrow.
    expect(splitPersonName('Martine Verweij (SDL)')).toEqual({
      first: 'Martine',
      last: 'Verweij (SDL)',
    });
    expect(splitPersonName('Sjoerd (Solidarity Lab)')).toEqual({
      first: 'Sjoerd',
      last: '(Solidarity Lab)',
    });
    expect(splitPersonName('Calender (OS)')).toEqual({ first: 'Calender', last: '(OS)' });
    // Lowercase: a note on the row, not a name. Production really holds this
    // one, which is how the guard got its third clause.
    expect(splitPersonName('Sjoerd Luteyn (test)')).toEqual({
      first: 'Sjoerd',
      last: 'Luteyn (test)',
    });
    expect(splitPersonName('Bakker J.W. (extern)')).toEqual({
      first: 'Bakker',
      last: 'J.W. (extern)',
    });
  });

  it('leaves an ordinary name exactly as it was', () => {
    // The regression that matters: most names are not a directory form, and
    // nothing above may touch them.
    expect(splitPersonName('Rense Bos')).toEqual({ first: 'Rense', last: 'Bos' });
    expect(splitPersonName('Richard Rozemeijer')).toEqual({
      first: 'Richard',
      last: 'Rozemeijer',
    });
    expect(splitPersonName('Daniel van der Berg')).toEqual({
      first: 'Daniel',
      last: 'van der Berg',
    });
    expect(splitPersonName('Marja')).toEqual({ first: 'Marja', last: null });
  });

  it('never invents a name from a broken form', () => {
    // A trailing comma, an empty bracket: fall through rather than produce
    // an empty string, which is the thing this function exists to prevent.
    expect(splitPersonName('Verweij,')).toEqual({ first: 'Verweij,', last: null });
    expect(splitPersonName('(Raquel)')).toEqual({ first: '(Raquel)', last: null });
    expect(splitPersonName('R.G.M. (Raquel)')).toEqual({ first: 'R.G.M.', last: '(Raquel)' });
  });
});

