import { describe, expect, it } from 'vitest';
import { effectiveInterval } from './membership-interval.js';

describe('effectiveInterval', () => {
  it('an unpriced tier renews yearly whatever was asked (the launch-test defect)', () => {
    expect(effectiveInterval({ price_cents_year: null, price_cents_month: null }, 'year')).toBe('year');
    expect(effectiveInterval({ price_cents_year: null, price_cents_month: null }, 'month')).toBe('year');
    expect(effectiveInterval({}, 'month')).toBe('year');
    expect(effectiveInterval(null, 'month')).toBe('year');
    expect(effectiveInterval({ price_cents_year: 0, price_cents_month: 0 }, 'month')).toBe('year');
  });

  it('a priced interval is honoured', () => {
    expect(effectiveInterval({ price_cents_year: 30000, price_cents_month: 3000 }, 'year')).toBe('year');
    expect(effectiveInterval({ price_cents_year: 30000, price_cents_month: 3000 }, 'month')).toBe('month');
  });

  it('only the other interval priced → that one', () => {
    expect(effectiveInterval({ price_cents_year: 30000, price_cents_month: null }, 'month')).toBe('year');
    expect(effectiveInterval({ price_cents_year: null, price_cents_month: 3000 }, 'year')).toBe('month');
  });
});
