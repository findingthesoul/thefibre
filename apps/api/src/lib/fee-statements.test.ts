import { describe, expect, it } from 'vitest';
import { feeVatSplit, monthWindow, previousMonth } from './fee-statements.js';

const NL = { home_country: 'NL', eu_b2b_reverse_charge: true, rates: { NL: 21, DE: 19, BE: 21 } };

describe('monthWindow', () => {
  it('is the UTC month, half-open', () => {
    const w = monthWindow('2026-09');
    expect(w.start).toBe('2026-09-01T00:00:00.000Z');
    expect(w.end).toBe('2026-10-01T00:00:00.000Z');
    expect(w.label).toBe('September 2026');
  });
  it('rolls the year at December', () => {
    expect(monthWindow('2026-12').end).toBe('2027-01-01T00:00:00.000Z');
  });
  it('refuses anything but YYYY-MM', () => {
    expect(() => monthWindow('2026-9')).toThrow();
    expect(() => monthWindow('2026-13')).toThrow();
  });
});

describe('previousMonth', () => {
  it('steps back one month, across a year boundary too', () => {
    expect(previousMonth(new Date('2026-09-15T10:00:00Z'))).toBe('2026-08');
    expect(previousMonth(new Date('2026-01-02T00:00:00Z'))).toBe('2025-12');
  });
});

describe('feeVatSplit', () => {
  it('carves domestic VAT out of the collected fee (inclusive, never added)', () => {
    // €0.20 collected on a Free-plan €10 ticket: €0.17 + €0.03 VAT.
    expect(feeVatSplit(20, null, NL)).toEqual({
      subtotal_cents: 17,
      tax_cents: 3,
      tax_label: 'incl. VAT 21% (NL)',
      reverse_charge: false,
    });
    // €200 (the cap) → €165.29 + €34.71
    const cap = feeVatSplit(20000, 'NL123456789B01', NL);
    expect(cap.subtotal_cents + cap.tax_cents).toBe(20000);
    expect(cap.tax_cents).toBe(3471);
  });

  it('reverse-charges an EU workspace with a foreign VAT number', () => {
    expect(feeVatSplit(20, 'DE123456789', NL)).toEqual({
      subtotal_cents: 20,
      tax_cents: 0,
      tax_label: 'VAT reverse-charged (EU B2B)',
      reverse_charge: true,
    });
  });

  it('treats a home-country VAT number, or none, as domestic', () => {
    expect(feeVatSplit(100, 'NL999999999B01', NL).tax_cents).toBe(17);
    expect(feeVatSplit(100, '', NL).tax_cents).toBe(17);
  });

  it('a non-EU prefix is not reverse-charged (it is domestic until a country field exists)', () => {
    expect(feeVatSplit(100, 'GB123', NL).reverse_charge).toBe(false);
  });
});
