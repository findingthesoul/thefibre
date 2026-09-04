// DIY VAT on Stripe rails — no Stripe Tax fee ("we can do tax collections
// ourselves, no?" — Sjoerd, 2026-09-04, go given). OUR table (/admin/vat)
// becomes plain Stripe tax_rate objects; checkout pins the rate for the
// billing country the buyer chose in-app (dynamic_tax_rates is dead on
// current Stripe API versions — country must be known up front); renewals
// carry it as the subscription's default; the post-checkout reconciliation
// corrects the rate if the address typed at Stripe names a different
// country; EU B2B customers with a VIES-validated VAT number are marked
// tax_exempt='reverse'. Stripe applies numbers; it decides nothing.

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

/** The single rate for a country (checkout / renewals / switches), or null. */
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

/**
 * Post-checkout tax reconciliation. The rate was pinned from the country the
 * buyer chose IN-APP, but the address they then typed at Stripe is the legal
 * one. If the two disagree, correct the subscription's default rate so every
 * following invoice taxes by the real country (the first invoice keeps the
 * pinned rate — logged loudly so the operator can credit/rebill if it ever
 * matters). Also runs the reverse-charge pass.
 */
export async function reconcileSubscriptionTax(
  customerId: string,
  subscriptionId: string | null,
): Promise<void> {
  await applyReverseChargeIfEligible(customerId);
  try {
    const stripe = stripeOrNull();
    if (!stripe || !subscriptionId) return;
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted || customer.tax_exempt === 'reverse') return;
    const country = customer.address?.country?.toUpperCase() ?? null;
    const rightId = await taxRateIdFor(country);
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const currentIds = (sub.default_tax_rates ?? []).map((r) => r.id);
    const same = rightId
      ? currentIds.length === 1 && currentIds[0] === rightId
      : currentIds.length === 0;
    if (same) return;
    await stripe.subscriptions.update(subscriptionId, {
      automatic_tax: { enabled: false },
      // '' is Stripe's documented way to unset default_tax_rates.
      default_tax_rates: rightId ? [rightId] : ('' as unknown as string[]),
      proration_behavior: 'none',
    });
    console.warn(
      `[vat-stripe] ${subscriptionId}: billing address says ${country ?? 'out of scope'} but checkout taxed [${currentIds.join(',')}] — future invoices corrected; check the first one`,
    );
  } catch (e) {
    console.error('[vat-stripe] subscription tax reconciliation failed', e);
  }
}

export type { Stripe };
