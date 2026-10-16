// The subscription checkout's lines (lifted out of /public/join, 2026-10-16,
// so a product subscribed to on its own uses the SAME builder). Each case is
// the join's own shape before the lift, plus the product-only shapes.

import { describe, expect, it } from 'vitest';
import { subscriptionLines } from './membership.js';

type L = { price_data?: { unit_amount?: number; recurring?: { interval: string }; product_data?: { name?: string } }; tax_rates?: string[] };
const brief = (lines: unknown[]) =>
  (lines as L[]).map((l) => `${l.price_data!.product_data!.name}:${l.price_data!.unit_amount}${l.price_data!.recurring ? `/${l.price_data!.recurring.interval}` : ''}`);
const extras = [
  { name: 'Workshop', price_cents: 2000, price_interval: 'once' },
  { name: 'Sheet music', price_cents: 5000, price_interval: 'year' },
  { name: 'Free thing', price_cents: 0, price_interval: 'once' },
];
const taxed = { tax_rates: ['txr_1'] };

describe('subscriptionLines', () => {
  it('an ordinary join: the tier IS the subscription; a once extra now; a recurring extra recurs', () => {
    const l = subscriptionLines({ currency: 'EUR', interval: 'year', split: false, taxed, main: { name: 'Choir membership — Singer', nowCents: 30000, listCents: 30000 }, extras });
    expect(brief(l)).toEqual(['Choir membership — Singer:30000/year', 'Workshop:2000', 'Sheet music:5000/year']);
    expect((l as L[]).every((x) => x.tax_rates?.[0] === 'txr_1')).toBe(true);
  });

  it('split (a cohort date or a first-period code): paid now as one-offs, full price recurring from the trial end — tier AND recurring extras', () => {
    const l = subscriptionLines({ currency: 'eur', interval: 'year', split: true, taxed: {}, main: { name: 'M', nowCents: 15000, listCents: 30000 }, extras });
    expect(brief(l)).toEqual(['M:15000', 'M:30000/year', 'Workshop:2000', 'Sheet music:5000', 'Sheet music:5000/year']);
  });

  it('a 100% code: nothing paid now is omitted (Stripe refuses a zero line); the subscription stays', () => {
    const l = subscriptionLines({ currency: 'EUR', interval: 'month', split: true, taxed: {}, main: { name: 'M', nowCents: 0, listCents: 1000 }, extras: [] });
    expect(brief(l)).toEqual(['M:1000/month']);
  });

  it('a product on its own (no tier): the recurring product recurs, a once product is a one-off', () => {
    const l = subscriptionLines({ currency: 'EUR', interval: 'month', split: false, taxed: {}, main: null, extras: [{ name: 'Circle', price_cents: 1500, price_interval: 'month' }, { name: 'Kit', price_cents: 900, price_interval: 'once' }] });
    expect(brief(l)).toEqual(['Circle:1500/month', 'Kit:900']);
  });

  it('a product on its own with a first-period date: its first period now, full price from the date', () => {
    const l = subscriptionLines({ currency: 'EUR', interval: 'year', split: true, taxed: {}, main: null, extras: [{ name: 'Circle', price_cents: 12000, price_interval: 'year' }] });
    expect(brief(l)).toEqual(['Circle:12000', 'Circle:12000/year']);
  });
});
