import { describe, expect, it } from 'vitest';
import {
  resolveUiLocale,
  resolvePublicLocale,
  resolveEmailLocale,
  localeFromAcceptLanguage,
} from './locale-resolution.js';

describe('the signed-in interface', () => {
  it('is the reader’s own choice, cookie first', () => {
    expect(resolveUiLocale({ cookie: 'nl', profile: 'de' })).toBe('nl');
  });

  it('falls back to the profile so the setting follows them between devices', () => {
    expect(resolveUiLocale({ cookie: undefined, profile: 'de' })).toBe('de');
  });

  it('is English when nothing is set, or set to something we do not speak', () => {
    expect(resolveUiLocale({})).toBe('en');
    expect(resolveUiLocale({ cookie: 'kl', profile: 'zz' })).toBe('en');
  });
});

describe('a public page', () => {
  it('honours the override on the thing itself above everything', () => {
    expect(
      resolvePublicLocale({ surfaceOverride: 'en', ownerProfile: 'nl', visitorPreference: 'de' }),
    ).toBe('en');
  });

  it('uses the owner’s language when nothing overrides it', () => {
    expect(resolvePublicLocale({ ownerProfile: 'nl', visitorPreference: 'de' })).toBe('nl');
  });

  it('only guesses from the visitor when nobody has decided', () => {
    expect(resolvePublicLocale({ visitorPreference: 'de' })).toBe('de');
    expect(resolvePublicLocale({})).toBe('en');
  });

  it('never lets a visitor’s browser overrule a deliberate choice', () => {
    // The point of the override is a page you decided is English. A German
    // browser must not undo that.
    expect(resolvePublicLocale({ surfaceOverride: 'en', visitorPreference: 'de' })).toBe('en');
  });
});

describe('an email', () => {
  it('is in the reader’s language when we know it', () => {
    expect(resolveEmailLocale({ recipientProfile: 'de', surface: 'nl' })).toBe('de');
  });

  it('falls back to the language of the page it followed from', () => {
    expect(resolveEmailLocale({ surface: 'nl' })).toBe('nl');
  });

  it('is English for a stranger from an untranslated surface', () => {
    expect(resolveEmailLocale({})).toBe('en');
  });
});

describe('Accept-Language', () => {
  it('reads quality values rather than order', () => {
    // Left to right says French; the weights say Dutch, and the weights win.
    expect(localeFromAcceptLanguage('fr;q=0.2, nl;q=0.9')).toBe('nl');
  });

  it('drops the region — nl-BE is Dutch to us', () => {
    expect(localeFromAcceptLanguage('nl-BE,nl;q=0.9')).toBe('nl');
  });

  it('skips languages we do not speak and takes the next one we do', () => {
    expect(localeFromAcceptLanguage('is,da;q=0.9,de;q=0.5')).toBe('de');
  });

  it('is null rather than English when nothing matches, so the caller decides', () => {
    expect(localeFromAcceptLanguage('is,da')).toBeNull();
    expect(localeFromAcceptLanguage('')).toBeNull();
    expect(localeFromAcceptLanguage(undefined)).toBeNull();
  });

  it('ignores a zero-weight tag, which means "not this one"', () => {
    expect(localeFromAcceptLanguage('nl;q=0, de')).toBe('de');
  });
});
