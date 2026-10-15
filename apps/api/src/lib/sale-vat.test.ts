// The one rule for VAT added on top of an app sale (lib/sale-vat.ts).
import { describe, expect, it } from 'vitest';
import { saleVatFrom } from './sale-vat.js';

const cfg = { home_country: 'NL', eu_b2b_reverse_charge: true, rates: { NL: 21, BE: 21, DE: 19 } };
const sale = (over: Partial<Parameters<typeof saleVatFrom>[1]> = {}) =>
  saleVatFrom(cfg, { net_cents: 30000, seller_registered: true, country: 'NL', vat_id_valid: false, ...over });

describe('VAT on top of an excl. price', () => {
  it('an NL consumer: 300 + 21% = 363', () => {
    expect(sale()).toMatchObject({ net_cents: 30000, tax_cents: 6300, gross_cents: 36300, rate_pct: 21, label: 'VAT 21%', reverse_charge: false });
  });
  it('an EU consumer abroad pays the HOME rate by default (a small NL seller charges NL VAT)', () => {
    expect(sale({ country: 'de' })).toMatchObject({ tax_cents: 6300, gross_cents: 36300, rate_pct: 21, country: 'DE', rate_country: 'NL' });
  });
  it('…and the destination rate only when the table says so (OSS-registered seller)', () => {
    const dest = saleVatFrom({ ...cfg, consumer_rate: 'destination' } as never, { net_cents: 30000, seller_registered: true, country: 'DE', vat_id_valid: false });
    expect(dest).toMatchObject({ tax_cents: 5700, rate_pct: 19, rate_country: 'DE' });
  });
  it('a BE business with a VIES-valid number: reverse charge, 300', () => {
    expect(sale({ country: 'BE', vat_id_valid: true })).toMatchObject({ tax_cents: 0, gross_cents: 30000, reverse_charge: true, label: 'VAT reverse-charged' });
  });
  it('a number VIES did not confirm is a consumer', () => {
    expect(sale({ country: 'BE', vat_id_valid: false }).gross_cents).toBe(36300);
  });
  it('an NL business still pays NL VAT (no reverse charge at home)', () => {
    expect(sale({ country: 'NL', vat_id_valid: true }).gross_cents).toBe(36300);
  });
  it('outside the EU: 300, out of scope', () => {
    expect(sale({ country: 'US' })).toMatchObject({ gross_cents: 30000, tax_cents: 0, label: 'VAT out of scope (outside the EU)' });
  });
  it('a seller not VAT-registered adds nothing', () => {
    expect(sale({ seller_registered: false })).toMatchObject({ gross_cents: 30000, tax_cents: 0, label: null });
  });
  it('a free sale adds nothing', () => {
    expect(sale({ net_cents: 0 }).gross_cents).toBe(0);
  });
});

describe('the ledger breakdown from what Stripe invoiced', async () => {
  const { vatBreakdownFromInvoice, vatMetadata } = await import('../routes/membership.js');
  it('a subscription under the excl. rule: net / VAT / label from the invoice', () => {
    const meta = vatMetadata(sale());
    expect(meta).toEqual({ vat_rule: 'excl', vat_rate_pct: '21', vat_label: 'VAT 21%' });
    const inv = { subtotal: 30000, subtotal_excluding_tax: 30000, amount_paid: 36300, total_taxes: [{ amount: 6300 }] } as never;
    expect(vatBreakdownFromInvoice(inv, meta)).toEqual({ subtotal_cents: 30000, tax_cents: 6300, tax_label: 'VAT 21%' });
  });
  it('reverse charge: zero tax, labelled', () => {
    const meta = vatMetadata(sale({ country: 'BE', vat_id_valid: true }));
    const inv = { subtotal: 30000, subtotal_excluding_tax: 30000, amount_paid: 30000, total_taxes: [] } as never;
    expect(vatBreakdownFromInvoice(inv, meta)).toEqual({ subtotal_cents: 30000, tax_cents: 0, tax_label: 'VAT reverse-charged' });
  });
  it('an older subscription (no vat_rule) is left to the old inclusive split', () => {
    expect(vatBreakdownFromInvoice({ subtotal: 30000, subtotal_excluding_tax: 30000, amount_paid: 30000, total_taxes: [] } as never, {})).toEqual({});
  });
});
