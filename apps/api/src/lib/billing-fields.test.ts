// Whose name goes on the invoice, and what Stripe is told.
//
// Both answers used to be Stripe's: the join handed over an email and let
// Stripe's page ask for an address. Now the panel asks and we write it onto
// the customer the charge is made against, which makes these two small
// functions the place where "who is paying, and where are they" is decided.

import { describe, expect, it } from 'vitest';
import { invoiceName, stripeAddress } from './billing-fields.js';
import { billingMetadata, readBillingMetadata } from './membership-customer.js';

describe('whose name the invoice carries', () => {
  it('is the person when they are paying for themselves', () => {
    expect(invoiceName({ payer: 'self', company: 'Acme BV' }, 'Marja de Vries')).toBe(
      'Marja de Vries',
    );
  });

  // The whole reason "Who pays?" is a question on the form rather than a
  // guess from the fields: a sole trader has a company name and may still be
  // buying personally, and the invoice has to say which.
  it('is the organisation when they said so', () => {
    expect(invoiceName({ payer: 'organisation', company: 'Acme BV' }, 'Marja')).toBe('Acme BV');
  });

  it('falls back to the person when the organisation has no name', () => {
    expect(invoiceName({ payer: 'organisation', company: '   ' }, 'Marja')).toBe('Marja');
  });

  // A form that never asked (another app, an older page) still means
  // something by a typed company name.
  it('uses a company name typed without the question being asked', () => {
    expect(invoiceName({ company: 'Acme BV' }, 'Marja')).toBe('Acme BV');
  });

  it('is the person when nothing was collected at all', () => {
    expect(invoiceName(null, 'Marja')).toBe('Marja');
    expect(invoiceName(undefined, 'Marja')).toBe('Marja');
    expect(invoiceName({}, 'Marja')).toBe('Marja');
  });
});

describe('the address Stripe is given', () => {
  it('is nothing when no street was typed', () => {
    // An individual paying by card types none of this, and the join must
    // work. Stripe then asks for whatever the card needs.
    expect(stripeAddress(null)).toBeNull();
    expect(stripeAddress({ city: 'Rotterdam', country: 'NL' })).toBeNull();
    expect(stripeAddress({ address: '   ' })).toBeNull();
  });

  it('carries what was typed', () => {
    expect(
      stripeAddress({
        address: 'Sint-Jobsweg 30',
        postal_code: '3024 EJ',
        city: 'Rotterdam',
        country: 'NL',
      }),
    ).toEqual({
      line1: 'Sint-Jobsweg 30',
      postal_code: '3024 EJ',
      city: 'Rotterdam',
      country: 'NL',
    });
  });

  // The form asks for a country NAME and Stripe wants a two-letter code.
  // Found by walking the panel on staging: the first version of this only
  // accepted a code, so anybody typing "Netherlands" — which is what the
  // field asks for — would have had the country dropped from their invoice
  // without a word.
  it('resolves a country NAME to its code', () => {
    expect(stripeAddress({ address: 'X 1', country: 'Netherlands' })!.country).toBe('NL');
    expect(stripeAddress({ address: 'X 1', country: '  netherlands ' })!.country).toBe('NL');
    expect(stripeAddress({ address: 'X 1', country: 'Germany' })!.country).toBe('DE');
  });

  it('accepts a code as typed, in either case', () => {
    expect(stripeAddress({ address: 'X 1', country: 'nl' })!.country).toBe('NL');
    expect(stripeAddress({ address: 'X 1', country: 'NL' })!.country).toBe('NL');
  });

  // Never a guess: a wrong country on an invoice is worse than none, and
  // Stripe refuses the whole customer over a code it does not know.
  it('leaves out a country it cannot recognise', () => {
    for (const bad of ['The Netherlands', 'Nederland', 'ZZ', 'Atlantis', '???']) {
      const r = stripeAddress({ address: 'Sint-Jobsweg 30', country: bad })!;
      expect(r.country, `${bad} is not a country we can name`).toBeUndefined();
      expect(r.line1, 'and the rest of the address still goes').toBe('Sint-Jobsweg 30');
    }
  });

  it('drops blanks rather than sending empty strings', () => {
    expect(stripeAddress({ address: 'X 1', city: '  ', postal_code: '' })).toEqual({
      line1: 'X 1',
    });
  });
});

describe('what rides the subscription metadata and comes back', () => {
  // The address makes the round trip through the Stripe customer. These two
  // cannot: a tax number is a separate TaxID object with a type we would have
  // to guess at, and "who pays" is our question, not Stripe's.
  it('carries the company, the tax number and who pays', () => {
    const meta = billingMetadata({
      payer: 'organisation',
      company: 'Acme BV',
      tax_no: 'NL123456789B01',
      address: 'Sint-Jobsweg 30',
    });
    expect(readBillingMetadata(meta)).toEqual({
      payer: 'organisation',
      company: 'Acme BV',
      tax_no: 'NL123456789B01',
    });
    // Not the address — that is on the customer, and two copies of one fact
    // is how they come to disagree.
    expect(JSON.stringify(meta)).not.toContain('Sint-Jobsweg');
  });

  it('carries nothing when there is nothing to carry', () => {
    expect(billingMetadata(null)).toEqual({});
    expect(billingMetadata({ address: 'Only a street' })).toEqual({});
    expect(readBillingMetadata({})).toEqual({});
    expect(readBillingMetadata(undefined)).toEqual({});
  });

  // Read on a webhook that cannot be re-run: a truncated or hand-edited value
  // must not take the invoice row down with it.
  it('reads nonsense as nothing rather than throwing', () => {
    expect(readBillingMetadata({ billing_extra: '{"company":"Acm' })).toEqual({});
    expect(readBillingMetadata({ billing_extra: 'null' })).toEqual({});
    expect(readBillingMetadata({ billing_extra: '[]' })).toEqual({});
    expect(readBillingMetadata({ billing_extra: '{"company":42}' })).toEqual({});
  });

  it('stays inside Stripe’s 500-character metadata limit', () => {
    const meta = billingMetadata({
      payer: 'organisation',
      company: 'C'.repeat(200),
      tax_no: 'T'.repeat(60),
    });
    expect(meta.billing_extra!.length).toBeLessThanOrEqual(480);
  });
});
