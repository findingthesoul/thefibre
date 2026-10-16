import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import { invoiceLines } from './invoice-lines.js';

const inv = (lines: unknown[]) => ({ lines: { data: lines } }) as unknown as Pick<Stripe.Invoice, 'lines'>;

describe('invoiceLines — what a basket invoice was for', () => {
  it('one line per thing, net and VAT apart, recurring known by its parent', () => {
    expect(
      invoiceLines(
        inv([
          { description: '1 × Soul membership — Singer (at €300.00 / year)', amount: 30000, taxes: [{ amount: 6300 }], parent: { type: 'subscription_item_details' } },
          { description: '1 × Sheet music (at €50.00 / year)', amount: 5000, taxes: [{ amount: 1050 }], parent: { type: 'subscription_item_details' } },
          { description: 'Workshop', amount: 2000, taxes: [{ amount: 420 }], parent: { type: 'invoice_item_details' } },
        ]),
      ),
    ).toEqual([
      { label: 'Soul membership — Singer', net_cents: 30000, vat_cents: 6300, recurring: true },
      { label: 'Sheet music', net_cents: 5000, vat_cents: 1050, recurring: true },
      { label: 'Workshop', net_cents: 2000, vat_cents: 420, recurring: false },
    ]);
  });
  it('no taxes, no VAT; no lines, no rows', () => {
    expect(invoiceLines(inv([{ description: 'Workshop', amount: 2000 }]))).toEqual([{ label: 'Workshop', net_cents: 2000, vat_cents: 0, recurring: false }]);
    expect(invoiceLines({ lines: undefined } as never)).toEqual([]);
  });
});
