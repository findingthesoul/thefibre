// VAT ADDED ON TOP of an app sale's price — the one rule for an EXCLUSIVE
// price (Sjoerd, 2026-10-15: "VAT — something went wrong. The price of
// someone who booked was 300. She comes from NL. It means VAT needs to be
// added. She now paid too little. Prices in the app are excl. VAT").
//
// Until now every app sale treated its price as VAT-INCLUSIVE
// (lib/seller-vat.ts carves the VAT out of what was paid) and nothing ever
// looked at the BUYER. This module is the other model, and the same function
// feeds the panel's quote, the Stripe line's tax rate and the ledger/invoice,
// so what the buyer is shown, charged and invoiced cannot disagree.
//
// The rules are the platform's VAT table (/admin/vat, lib/vat.ts):
//   · seller not VAT-registered            → no VAT
//   · buyer in the seller's home country   → home rate
//   · EU business with a VIES-valid number → reverse charge (0, labelled)
//   · EU consumer                          → the HOME rate (see below)
//   · outside the EU                       → out of scope (0, labelled)
// A VAT number VIES cannot confirm (invalid, or VIES down) is treated as a
// consumer: charging VAT is the side a seller can correct afterwards.

import { getVatRates, type VatRates } from './vat.js';
import { resolveSellerVat } from './seller-vat.js';
import { validateVatNumber } from './vies.js';

export type SaleVat = {
  net_cents: number;
  tax_cents: number;
  gross_cents: number;
  /** 0 when no VAT is added (not registered, reverse charge, non-EU). */
  rate_pct: number;
  /** For the invoice and the panel: "VAT 21%", "VAT reverse-charged", … */
  label: string | null;
  reverse_charge: boolean;
  /** The buyer's country (upper case), when known. */
  country: string | null;
  /** The jurisdiction whose rate is charged — the seller's home unless the
   *  table charges destination rates. What the Stripe tax rate is made for. */
  rate_country: string | null;
};

/** The pure half: given the table, the seller's registration and the buyer. */
export function saleVatFrom(
  cfg: VatRates,
  input: { net_cents: number; seller_registered: boolean; country: string | null; vat_id_valid: boolean },
): SaleVat {
  const none = (label: string | null, reverse = false): SaleVat => ({
    net_cents: input.net_cents,
    tax_cents: 0,
    gross_cents: input.net_cents,
    rate_pct: 0,
    label,
    reverse_charge: reverse,
    country: input.country ? input.country.toUpperCase() : null,
    rate_country: null,
  });
  if (!input.seller_registered || input.net_cents <= 0) return none(null);
  const home = cfg.home_country.toUpperCase();
  const country = (input.country || home).toUpperCase();
  if (!(country in cfg.rates)) return none('VAT out of scope (outside the EU)');
  if (country !== home && cfg.eu_b2b_reverse_charge && input.vat_id_valid) return none('VAT reverse-charged', true);
  // An EU consumer abroad pays the HOME rate unless the table says the
  // seller charges destination rates (coordinator, for Sjoerd's accountant,
  // 2026-10-15): the destination rate is right only for a seller registered
  // for OSS or above the EUR 10k cross-border threshold — and admission to an
  // in-person event is taxed where it happens. A small NL seller charges NL
  // VAT. `consumer_rate: 'destination'` in the table switches it.
  const destination = (cfg as VatRates & { consumer_rate?: string }).consumer_rate === 'destination';
  const rateCountry = destination && cfg.rates[country] !== undefined ? country : home;
  const pct = cfg.rates[rateCountry] ?? 21;
  const tax = Math.round((input.net_cents * pct) / 100);
  return {
    net_cents: input.net_cents,
    tax_cents: tax,
    gross_cents: input.net_cents + tax,
    rate_pct: pct,
    label: `VAT ${pct}%`,
    reverse_charge: false,
    country,
    rate_country: rateCountry,
  };
}

/** The whole rule for one sale: the seller's registration (workspace, or the
 *  organiser selling under their own name), the table, and VIES for a number. */
export async function saleVat(input: {
  workspaceId: string;
  organiserUserId?: string | null;
  net_cents: number;
  country: string | null;
  vat_id?: string | null;
}): Promise<SaleVat> {
  const [cfg, seller] = await Promise.all([getVatRates(), resolveSellerVat(input.workspaceId, input.organiserUserId)]);
  const vatId = input.vat_id?.trim() || null;
  const vatIdValid = vatId ? (await validateVatNumber(vatId)) === 'valid' : false;
  return saleVatFrom(cfg, {
    net_cents: input.net_cents,
    seller_registered: !!seller,
    country: input.country,
    vat_id_valid: vatIdValid,
  });
}
