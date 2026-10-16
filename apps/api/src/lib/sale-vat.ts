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
import { netFromInclusive } from '@thefibre/shared/price-logic';

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
  const destination = cfg.consumer_rate === 'destination';
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

/** The seller's HOME rate, or null — what the small "€363 incl. 21% VAT"
 *  line under a public price uses before the buyer's country is known
 *  (Sjoerd, 2026-10-16). THE rule the enrol and booking routes charge by
 *  (saleVat with no country = the home rate). Null when the seller is not
 *  VAT-registered, so the line is absent. A RATE, not an amount: a page shows
 *  several prices (tickets, a member price) and applies it to each; a price
 *  of 0 shows no line, which is the page's check, not this one's. */
export async function homeVatPct(input: {
  workspaceId: string;
  organiserUserId?: string | null;
}): Promise<number | null> {
  const v = await saleVat({
    workspaceId: input.workspaceId,
    organiserUserId: input.organiserUserId ?? null,
    net_cents: 10000,
    country: null,
  });
  return v.rate_pct > 0 ? v.rate_pct : null;
}

/** The ledger's breakdown of a sale (purchase.billing). Always carries
 *  tax_cents — 0 when no VAT is added — so recordPurchase never applies the
 *  old inclusive carve to a sale made under this rule. */
export function vatBilling(v: SaleVat): { subtotal_cents: number; tax_cents: number; tax_label: string | null } {
  return { subtotal_cents: v.net_cents, tax_cents: v.tax_cents, tax_label: v.label };
}

/** (A) or (B) — PENDING Sjoerd and his accountant (coordinator, 2026-10-16).
 *  For a price entered INCLUDING VAT, what does a buyer pay who owes no VAT
 *  here (an EU business with a valid number — reverse charge — or a buyer
 *  outside the EU)?
 *    true  (A): the NET — "€300 including our VAT", none is due, so €247,93.
 *    false (B): the full entered price, as the net — "€300 is the price".
 *  A server constant, like DOWNGRADE_REFUNDS: one switch, no data. */
export const INCLUSIVE_EXEMPT_PAYS_NET = true;

/** The NET to charge for a price as entered (2026-10-16, per tier/product
 *  "price includes VAT"). An excl. price is its own net. An incl. price is
 *  turned into the net at the community's HOME rate (netFromInclusive), so a
 *  buyer at home pays exactly what was entered; the VAT is then added by THE
 *  rule above, like any other sale. A community that is not VAT-registered
 *  ignores the flag entirely: the price is just the price.
 *
 *  Price logic and a discount code apply to the ENTERED price first; call
 *  this with the result. */
export async function chargeNet(input: {
  workspaceId: string;
  enteredCents: number;
  includesVat: boolean | null | undefined;
  /** Thread and Meet sell as the PERSON first (lib/seller-vat.ts): the
   *  organiser or host whose registration decides. Members passes none and
   *  is judged on the workspace, as before. */
  organiserUserId?: string | null;
  /** For the (B) case only: the buyer's country and VAT number. */
  country?: string | null;
  vat_id?: string | null;
}): Promise<number> {
  if (!input.includesVat || input.enteredCents <= 0) return input.enteredCents;
  const [cfg, seller] = await Promise.all([getVatRates(), resolveSellerVat(input.workspaceId, input.organiserUserId ?? null)]);
  if (!seller) return input.enteredCents;
  if (!INCLUSIVE_EXEMPT_PAYS_NET) {
    const v = await saleVat({ workspaceId: input.workspaceId, organiserUserId: input.organiserUserId ?? null, net_cents: input.enteredCents, country: input.country ?? null, vat_id: input.vat_id ?? null });
    if (v.rate_pct === 0) return input.enteredCents;
  }
  const home = cfg.home_country.toUpperCase();
  return netFromInclusive(input.enteredCents, cfg.rates[home] ?? 21);
}
