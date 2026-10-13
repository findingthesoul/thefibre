// What an invoice contains, asserted.

import { describe, expect, it } from 'vitest';
import { invoiceModel } from './invoice-model.js';

// ─────────────────────────────────────────────────────────────────────────────
// A LEGAL INVOICE SAYS "Netherlands", NOT "NL".
//
// The invoicing form became a country PICKER on 2026-10-14 and posts ISO
// codes. Printing the stored value raw would have put the code on the PDF,
// the receipt email and the invoices dialog — all three read this model — the
// moment the picker shipped. Rows written before it hold a NAME, often one no
// list would recognise ("Nederland"), and an invoice already issued has to
// keep reading as it did.
// ─────────────────────────────────────────────────────────────────────────────
describe('the buyer country on an invoice', () => {
  const withCountry = (country: string | null) =>
    invoiceModel({
      id: 'p1',
      amount_cents: 1000,
      currency: 'EUR',
      status: 'paid',
      method: 'invoice',
      payer_name: 'A Buyer',
      created_at: '2026-10-14T10:00:00Z',
      billing: { address: 'Sint-Jobsweg 30', postal_code: '3024 EJ', city: 'Rotterdam', country },
    } as never);

  it('prints the NAME for a code the picker posts', () => {
    expect(withCountry('NL').buyer.address).toContain('Netherlands');
    expect(withCountry('NL').buyer.address, 'never the bare code').not.toMatch(/,\s*NL$/);
  });

  it('keeps whatever an older row holds', () => {
    // These were typed into a free-text box before the picker existed. An
    // invoice already issued must keep reading as it did.
    for (const typed of ['Nederland', 'The Netherlands', 'Netherlands']) {
      expect(withCountry(typed).buyer.address, typed).toContain(typed);
    }
  });

  it('leaves the line alone when there is no country', () => {
    const line = withCountry(null).buyer.address ?? '';
    expect(line).toContain('Sint-Jobsweg 30');
    expect(line.endsWith('Rotterdam'), 'no trailing separator').toBe(true);
  });
});
