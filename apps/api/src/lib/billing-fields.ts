// What an invoice needs from the buyer, as one schema.
//
// The FORM half has been shared since it was written: `InvoiceBillingFields`
// and `readBillingFields` in @thefibre/shared/ui/payment-methods, used by
// Thread's enrol form and Meet's booking flow. The schema that receives it
// was not — Thread had it inline, and when the membership join needed the
// same fields the choice was to copy those eight lines or to lift them.
// Copied, they drift: a max length raised in one place and not the other is
// a field that saves in one app and 400s in another.
//
// It mirrors the shared `InvoiceBilling` type exactly. If a field is added
// there, add it here; a value the schema does not know is dropped silently,
// which on an invoice means an address that quietly loses its second line.

import { z } from 'zod';

export const BillingFields = z.object({
  company: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  postal_code: z.string().max(30).optional(),
  city: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
  tax_no: z.string().max(60).optional(),
  /** Who pays: the buyer themselves, or an organisation (20260915100000). */
  payer: z.enum(['self', 'organisation']).optional(),
});

export type BillingFieldsInput = z.infer<typeof BillingFields>;

/**
 * The name an invoice should carry: the organisation when somebody said they
 * are paying as one, the person otherwise.
 *
 * Asked as a question on the form ("Who pays?") rather than inferred from
 * whether a company name was typed — somebody can be a sole trader with a
 * company name and still be buying personally, and the invoice has to say
 * which.
 */
export function invoiceName(
  billing: BillingFieldsInput | null | undefined,
  personName: string,
): string {
  const company = (billing?.company ?? '').trim();
  if (billing?.payer === 'organisation' && company) return company;
  // No "Who pays?" asked at all (an older form, another app): a company name
  // on its own still means the invoice is for the company.
  if (!billing?.payer && company) return company;
  return personName;
}

/**
 * The address block Stripe understands, or null when nothing usable was
 * given. Stripe wants `line1` at minimum; an address of only a country is
 * worse than none, because it renders as a one-line invoice address that
 * looks like a mistake rather than like an omission.
 */
export function stripeAddress(
  billing: BillingFieldsInput | null | undefined,
): { line1: string; postal_code?: string; city?: string; country?: string } | null {
  const line1 = (billing?.address ?? '').trim();
  if (!line1) return null;
  const country = (billing?.country ?? '').trim();
  return {
    line1,
    ...(billing?.postal_code?.trim() ? { postal_code: billing.postal_code.trim() } : {}),
    ...(billing?.city?.trim() ? { city: billing.city.trim() } : {}),
    // Stripe wants a two-letter country code. The form asks for a country
    // NAME in Thread and Meet, so anything longer is left out rather than
    // sent for Stripe to reject the whole customer over.
    ...(/^[A-Za-z]{2}$/.test(country) ? { country: country.toUpperCase() } : {}),
  };
}
