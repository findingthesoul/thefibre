import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VatBreakdown, VatInclNote, vatOn } from './vat-price.js';

// The page multiplies the API's rate; the checkout's rule (saleVatFrom)
// rounds the same way, so the figure shown is the figure charged.
describe('vat-price', () => {
  it('rounds like saleVatFrom', () => {
    expect(vatOn(30000, 21)).toBe(6300);
    expect(vatOn(1950, 21)).toBe(410); // 409.5 → 410
  });

  it('the note says the gross at the rate, in the locale', () => {
    expect(renderToStaticMarkup(<VatInclNote netCents={30000} ratePct={21} locale="en" />)).toContain('incl. 21% VAT');
    expect(renderToStaticMarkup(<VatInclNote netCents={30000} ratePct={21} locale="en" />)).toMatch(/363/);
    expect(renderToStaticMarkup(<VatInclNote netCents={30000} ratePct={21} locale="nl" />)).toContain('btw');
  });

  it('no VAT, no note — not registered, reverse charge, outside the EU', () => {
    expect(renderToStaticMarkup(<VatInclNote netCents={30000} ratePct={null} />)).toBe('');
    expect(renderToStaticMarkup(<VatInclNote netCents={30000} ratePct={0} />)).toBe('');
  });

  it('the breakdown names a reverse charge and a sale outside the EU', () => {
    expect(renderToStaticMarkup(<VatBreakdown netCents={30000} quote={{ rate_pct: 0, reverse_charge: true }} locale="en" />)).toContain('reverse-charged');
    expect(renderToStaticMarkup(<VatBreakdown netCents={30000} quote={{ rate_pct: 0, reverse_charge: false }} locale="en" />)).toContain('outside the EU');
    const nl = renderToStaticMarkup(<VatBreakdown netCents={30000} quote={{ rate_pct: 21, reverse_charge: false }} locale="nl" />);
    expect(nl).toContain('Btw 21%');
    expect(nl).toMatch(/363/);
  });
});
