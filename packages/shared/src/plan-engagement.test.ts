import { describe, expect, it } from 'vitest';
import { engagementLine } from './plan-engagement.js';

const eur = (c: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(c / 100);

describe('what a plan says about setting up and training', () => {
  it('says nothing at all when the plan offers neither', () => {
    expect(engagementLine({}, eur)).toBeNull();
    expect(engagementLine({ setup_cents: null, training_day_cents: null }, eur)).toBeNull();
  });

  it('prints a deliberate zero, because somebody chose to type it', () => {
    // Zero says setup is included. Null says nothing is on offer. A falsy
    // check cannot tell them apart, which is the bug this pins.
    expect(engagementLine({ setup_cents: 0 }, eur)).toBe('€0 setup, one-off');
  });

  it('names all three when all three are set', () => {
    expect(
      engagementLine({ setup_cents: 250000, training_onboarding_cents: 120000, training_day_cents: 95000 }, eur),
    ).toBe('€2,500 setup · €1,200 onboarding training · €950 per training day, one-off');
  });

  it('names only what is offered', () => {
    expect(engagementLine({ training_day_cents: 95000 }, eur)).toBe('€950 per training day, one-off');
  });
});
