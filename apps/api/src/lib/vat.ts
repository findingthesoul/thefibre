// The VAT module — rates as DATA the operator maintains (/admin/vat), not
// constants in a deploy. Stripe Tax computes on card rails; this module is
// the platform's own reference and the calculator for every rail Stripe
// does not touch (invoice-method purchases, future PSPs).
//
// Rules implemented (NL-seated seller):
//  - home country            → home standard rate
//  - EU, business w/ VAT id  → reverse charge (0, labelled)
//  - EU, consumer            → destination country's standard rate (OSS)
//  - outside the EU          → out of scope (0, labelled)

import { getSetting, setSetting } from './platform-settings.js';

export type VatRates = {
  home_country: string;
  eu_b2b_reverse_charge: boolean;
  rates: Record<string, number>;
};

const FALLBACK: VatRates = {
  home_country: 'NL',
  eu_b2b_reverse_charge: true,
  rates: { NL: 21 },
};

export async function getVatRates(): Promise<VatRates> {
  return getSetting<VatRates>('vat_rates', FALLBACK);
}

export async function setVatRates(rates: VatRates): Promise<void> {
  await setSetting('vat_rates', rates);
}

export async function computeVat(input: {
  subtotal_cents: number;
  country: string | null;
  vat_id?: string | null;
}): Promise<{ tax_cents: number; tax_label: string; reverse_charge: boolean; rate_pct: number }> {
  const cfg = await getVatRates();
  const country = (input.country ?? cfg.home_country).toUpperCase();
  const inEu = country in cfg.rates;
  const home = country === cfg.home_country.toUpperCase();

  if (!inEu) {
    return { tax_cents: 0, tax_label: 'VAT out of scope (non-EU)', reverse_charge: false, rate_pct: 0 };
  }
  if (!home && cfg.eu_b2b_reverse_charge && input.vat_id) {
    return { tax_cents: 0, tax_label: 'VAT reverse-charged', reverse_charge: true, rate_pct: 0 };
  }
  const pct = cfg.rates[country] ?? cfg.rates[cfg.home_country] ?? 21;
  return {
    tax_cents: Math.round((input.subtotal_cents * pct) / 100),
    tax_label: `VAT ${pct}% (${country})`,
    reverse_charge: false,
    rate_pct: pct,
  };
}
