import { describe, expect, it } from 'vitest';
import { formatPeriod, money } from './money.js';

// Intl output contains non-breaking spaces; compare on the digits and sign.
const digits = (s: string) => s.replace(/[^\d,.\-]/g, '');

describe('money', () => {
  it("keeps the cents on a €19,50 tier (Membership's behaviour)", () => {
    expect(digits(money(1950))).toBe('19,50');
  });

  it('drops the decimals on a whole amount', () => {
    expect(digits(money(1900))).toBe('19');
  });

  it("rounds to whole units when asked (Pulse's planner behaviour)", () => {
    expect(digits(money(1950, 'EUR', 'nl-NL', { decimals: 'never' }))).toBe('20');
    expect(digits(money(1949, 'EUR', 'nl-NL', { decimals: 'never' }))).toBe('19');
  });

  it('formats in the requested locale and currency', () => {
    expect(money(123456, 'USD', 'en-US')).toBe('$1,234.56');
  });
});

describe('formatPeriod', () => {
  it('is UTC-anchored so a period start never slips a day', () => {
    expect(formatPeriod('2026-12-05')).toBe('5 Dec');
    expect(formatPeriod('2026-12-05', 'en-US')).toBe('Dec 5');
  });
});
