import { describe, expect, it } from 'vitest';
import { dayMonth, fmtDate, fmtDateTime, fmtLongDate, fmtTime, listOf, money } from './format';

// ENGLISH MUST NOT MOVE (2026-10-16, my.thread in six languages). Every
// function here hardcoded en-GB before it took a locale; these pin that an
// English page reads exactly as it did — once against the old implementation,
// copied here verbatim, and once against literal strings a person would see.

const old = {
  money: (cents: number, currency: string) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(cents / 100),
  fmtDate: (iso: string) =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)),
  fmtDateTime: (iso: string) =>
    new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso)),
  fmtTime: (iso: string) =>
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso)),
  list: (names: string[]) => new Intl.ListFormat('en', { type: 'conjunction' }).format(names),
};

const ISO = '2026-09-14T12:30:00Z';

describe('English reads exactly as before', () => {
  for (const locale of [undefined, null, 'en', 'xx'] as const) {
    it(`with locale ${String(locale)}`, () => {
      expect(money(123456, 'EUR', locale)).toBe(old.money(123456, 'EUR'));
      expect(fmtDate(ISO, locale)).toBe(old.fmtDate(ISO));
      expect(fmtDateTime(ISO, locale)).toBe(old.fmtDateTime(ISO));
      expect(fmtTime(ISO, locale)).toBe(old.fmtTime(ISO));
      expect(listOf(['Anna', 'Ben', 'Carla'], locale)).toBe(old.list(['Anna', 'Ben', 'Carla']));
    });
  }

  it('in the words a reader sees', () => {
    expect(money(123456, 'EUR')).toBe('€1,234.56');
    expect(fmtDate(ISO)).toBe('14 Sept 2026');
    expect(dayMonth(ISO)).toEqual({ day: '14', month: 'Sept' });
    expect(fmtLongDate(ISO)).toBe('14 September 2026');
    expect(listOf(['Anna', 'Ben', 'Carla'])).toBe('Anna, Ben, and Carla');
  });

  it('keeps an empty date empty', () => {
    expect(fmtDate(null)).toBeNull();
    expect(fmtLongDate('not a date')).toBe('—');
  });
});

describe('another language reads as that language', () => {
  it('Dutch', () => {
    expect(money(123456, 'EUR', 'nl')).toBe('€ 1.234,56');
    expect(fmtLongDate(ISO, 'nl')).toBe('14 september 2026');
    expect(listOf(['Anna', 'Ben', 'Carla'], 'nl')).toBe('Anna, Ben en Carla');
  });

  it('German and French', () => {
    expect(fmtLongDate(ISO, 'de')).toBe('14. September 2026');
    expect(fmtLongDate(ISO, 'fr')).toBe('14 septembre 2026');
  });
});
