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

describe('the lines of a basket invoice', () => {
  const base = { id: 'p1', item_label: 'Soul membership — Singer', amount_cents: 44770, currency: 'EUR', method: 'stripe', created_at: '2026-10-16T00:00:00Z', payer_name: 'A' };
  it('lists billing.lines when the ledger has them', () => {
    const m = invoiceModel({ ...base, billing: { subtotal_cents: 37000, tax_cents: 7770, lines: [
      { label: 'Soul membership — Singer', net_cents: 30000, recurring: true },
      { label: 'Sheet music', net_cents: 5000, recurring: true },
      { label: 'Workshop', net_cents: 2000 },
    ] } });
    expect(m.lines).toEqual([
      { label: 'Soul membership — Singer', amountCents: 30000, recurring: true },
      { label: 'Sheet music', amountCents: 5000, recurring: true },
      { label: 'Workshop', amountCents: 2000, recurring: false },
    ]);
    expect(m.lines.reduce((s, l) => s + l.amountCents, 0), 'the lines add up to the subtotal').toBe(m.totals.subtotalCents);
  });
  it('one line when there is one thing (every row written before the basket)', () => {
    expect(invoiceModel({ ...base, amount_cents: 30000 }).lines).toEqual([{ label: 'Soul membership — Singer', amountCents: 30000, recurring: false }]);
  });
});
