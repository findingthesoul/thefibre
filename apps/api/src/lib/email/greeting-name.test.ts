import { describe, expect, it } from 'vitest';
import { greetingName } from './membership-templates.js';

// ---------------------------------------------------------------------------
// "Welcome to soul.com, sjoerd." — Sjoerd, adding himself on production,
// 2026-10-14.
//
// A member an admin adds by hand often has no name: the person row is created
// from an email address, so `first_name` ends up as the local part.
//
// The easy fix is to capitalise every first name, and it is the wrong one. A
// name somebody typed is theirs — plenty of people write their own name
// lowercase on purpose, and a greeting that "corrects" it is a small rudeness
// at the exact moment we are trying to be welcoming. So the rule is narrow:
// capitalise ONLY when the name is the email's local part, which is the case
// where nobody chose it and we are reading a mailbox rather than a person.
// ---------------------------------------------------------------------------
describe('a name we made up from an address', () => {
  it('is capitalised', () => {
    expect(greetingName('sjoerd', 'sjoerd@soul.com')).toBe('Sjoerd');
  });

  it('is capitalised when the address carries a plus tag', () => {
    // `sjoerd+invitetest@soul.com` — the same mailbox, and the same
    // derivation, so the same correction. This is the exact case from
    // production.
    expect(greetingName('sjoerd', 'sjoerd+invitetest@soul.com')).toBe('Sjoerd');
  });

  it('is capitalised regardless of how the address is cased', () => {
    expect(greetingName('sjoerd', 'Sjoerd@soul.com')).toBe('Sjoerd');
  });
});

describe('a name somebody typed', () => {
  it('is left exactly as they wrote it', () => {
    // THE ONE THAT MATTERS. These are real naming conventions, not typos,
    // and a welcome email is the worst place to argue with somebody about
    // their own name.
    expect(greetingName('bell', 'hooks@example.com')).toBe('bell');
    expect(greetingName('danah', 'db@example.com')).toBe('danah');
    expect(greetingName('van Gogh', 'vincent@example.com')).toBe('van Gogh');
    expect(greetingName('McDonald', 'mcd@example.com')).toBe('McDonald');
  });

  it('is left alone even when it happens to be lowercase', () => {
    // Lowercase is not evidence of derivation; matching the local part is.
    expect(greetingName('anna', 'different@example.com')).toBe('anna');
  });

  it('is left alone when there is no address to compare against', () => {
    expect(greetingName('sjoerd', null)).toBe('sjoerd');
    expect(greetingName('sjoerd', undefined)).toBe('sjoerd');
    expect(greetingName('sjoerd', '')).toBe('sjoerd');
  });
});

describe('when there is no name at all', () => {
  it('falls back to something addressable', () => {
    // "Welcome to soul.com, ." would be worse than a generic word.
    for (const empty of [null, undefined, '', '   ']) {
      expect(greetingName(empty, 'someone@example.com'), JSON.stringify(empty)).toBe('there');
    }
  });
});
