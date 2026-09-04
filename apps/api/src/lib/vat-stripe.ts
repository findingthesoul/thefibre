// DIY VAT on Stripe rails — no Stripe Tax fee ("we can do tax collections
// ourselves, no?" — Sjoerd, 2026-09-04, go given). OUR table (/admin/vat)
// becomes plain Stripe tax_rate objects; Checkout picks the right one from
// the billing address via dynamic_tax_rates; renewals carry it as the
// subscription's default; EU B2B customers with a VIES-validated VAT number
// are marked tax_exempt='reverse'. Stripe applies numbers; it decides
// nothing.

import type Stripe from 'stripe';
import { stripeOrNull } from './stripe/client.js';
import { getVatRates } from './vat.js';
import { getSetting, setSetting } from './platform-settings.js';
import { validateVatNumber } from './vies.js';

type RateMap = Record<string, { id: string; pct: number }>;

export async function getStripeRateMap(): Promise<RateMap> {
  return getSetting<RateMap>('vat_stripe_rate_ids', {});
}

/** Mirror the table into Stripe tax_rate objects. Percentages are immutable
 *  on Stripe, so a changed rate archives the old object and creates a new
 *  one. Idempotent; cheap when nothing changed. */
export async function ensureStripeTaxRates(): Promise<void> {
  try {
    const stripe = stripeOrNull();
    if (!stripe) return;
    const cfg = await getVatRates();
    const map = await getStripeRateMap();
    let dirty = false;

    for (const [country, pct] of Object.entries(cfg.rates)) {
      const have = map[country];
      if (have && Math.abs(have.pct - pct) < 0.001) continue;
      if (have) {
        await stripe.taxRates.update(have.id, { active: false }).catch(() => {});
      }
      const rate = await stripe.taxRates.create({
        display_name: 'VAT',
        percentage: pct,
        country,
        inclusive: false,
        description: `VAT ${pct}% ${country} (Fibre table)`,
      });
      map[country] = { id: rate.id, pct };
      dirty = true;
      console.log(`[vat-stripe] tax rate ${country} ${pct}% → ${rate.id}`);
    }
    // Countries removed from the table: archive their Stripe object.
    for (const country of Object.keys(map)) {
      if (!(country in cfg.rates)) {
        await stripe.taxRates.update(map[country]!.id, { active: false }).catch(() => {});
        delete map[country];
        dirty = true;
      }
    }
    if (dirty) await setSetting('vat_stripe_rate_ids', map);
  } catch (e) {
    console.error('[vat-stripe] ensure rates failed', e);
  }
}

/** All active rate ids — Checkout's dynamic_tax_rates chooses by address. */
export async function dynamicTaxRateIds(): Promise<string[]> {
  const map = await getStripeRateMap();
  return Object.values(map).map((r) => r.id);
}

/** The single rate for a country (renewals / switches), or null. */
export async function taxRateIdFor(country: string | null): Promise<string | null> {
  if (!country) return null;
  const map = await getStripeRateMap();
  return map[country.toUpperCase()]?.id ?? null;
}

/**
 * Post-checkout reverse-charge pass: an EU (non-home) business customer with
 * a VIES-validated VAT number is marked tax_exempt='reverse' — renewals and
 * switches then carry no VAT and Stripe prints the reverse-charge note.
 * VIES down → left as-is; the weekly sync retries via the same call.
 */
export async function applyReverseChargeIfEligible(customerId: string): Promise<void> {
  try {
    const stripe = stripeOrNull();
    if (!stripe) return;
    const cfg = await getVatRates();
    if (!cfg.eu_b2b_reverse_charge) return;
    const customer = await stripe.customers.retrieve(customerId, { expand: ['tax_ids'] });
    if (customer.deleted) return;
    const country = customer.address?.country?.toUpperCase() ?? null;
    if (!country || !(country in cfg.rates) || country === cfg.home_country.toUpperCase()) return;
    if (customer.tax_exempt === 'reverse') return;
    const taxIds = (customer as unknown as { tax_ids?: { data?: { value?: string }[] } }).tax_ids;
    const vatId = taxIds?.data?.[0]?.value;
    if (!vatId) return;
    const vies = await validateVatNumber(vatId);
    if (vies !== 'valid') {
      if (vies === 'invalid') console.warn(`[vat-stripe] VIES rejects ${vatId} (${customerId})`);
      return;
    }
    await stripe.customers.update(customerId, { tax_exempt: 'reverse' });
    console.log(`[vat-stripe] ${customerId} reverse-charged (${country}, VIES-validated)`);
  } catch (e) {
    console.error('[vat-stripe] reverse-charge pass failed', e);
  }
}

export type { Stripe };
