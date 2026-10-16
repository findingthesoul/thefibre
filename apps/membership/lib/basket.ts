// THE PAGE BASKET — what is in it, what may go in, what it costs, and what
// the checkout posts (Sjoerd, 2026-10-16: "can I add the membership... and
// then add products... and I see the basket filling.... and I only have to
// fill in emails and data only once").
//
// Pure: no React, no fetch, no storage, no clock — so every rule here is
// pinned in basket.test.ts and the component only renders and wires. Prices
// are the catalogue's net prices adjusted by the SAME price logic the charge
// uses (@thefibre/shared/price-logic); VAT is the API's rate multiplied with
// the checkout rule's rounding (vatOn). The server decides everything again
// at checkout from what is posted — this is what the viewer is SHOWN.

import { applyPct, evaluatePriceLogic, netFromInclusive, type PriceLogic } from '@thefibre/shared/price-logic';
import { vatOn } from '@thefibre/shared/ui/vat-price';
import type { PublicProduct, PublicTier } from './public-api';

export type Interval = 'year' | 'month';
export type Basket = { tierId: string | null; interval: Interval; productIds: string[] };
export const EMPTY_BASKET: Basket = { tierId: null, interval: 'year', productIds: [] };

export type Catalog = {
  tiers: PublicTier[];
  products: PublicProduct[];
  priceLogic: PriceLogic | null;
  /** For a price entered INCL. VAT: the community adds VAT, at this home
   *  rate. Absent → every price is its own net (as before). */
  vat?: { registered: boolean; homeRatePct: number | null };
};

/** The NET of a price as entered — the same derivation the server charges
 *  by (netFromInclusive at the home rate), only when the community is
 *  VAT-registered and the row says its price includes VAT. */
export function netOf(c: Catalog, enteredCents: number, includesVat: boolean | undefined): number {
  if (!includesVat || !c.vat?.registered || !c.vat.homeRatePct) return enteredCents;
  return netFromInclusive(enteredCents, c.vat.homeRatePct);
}

const tierOf = (c: Catalog, b: Basket) => (b.tierId ? c.tiers.find((t) => t.id === b.tierId) ?? null : null);
const has = (cents: number | null | undefined) => cents != null && cents > 0;

/** The intervals a tier is sold at. */
export function intervalsOf(tier: PublicTier): Interval[] {
  return [...(has(tier.price_cents_year) ? (['year'] as const) : []), ...(has(tier.price_cents_month) ? (['month'] as const) : [])];
}

/** The renewal interval of the renewing products in the basket other than
 *  `except` — null when there are none. */
function basketProductInterval(c: Catalog, b: Basket, except?: string): string | null {
  for (const id of b.productIds) {
    if (id === except) continue;
    const iv = c.products.find((x) => x.id === id)?.price_interval ?? 'once';
    if (iv !== 'once') return iv;
  }
  return null;
}

/** May this product be in this basket? A one-off always fits. A recurring
 *  one rides a membership of its own interval (one subscription, one
 *  interval — as at join); WITHOUT a membership it is subscribed to on its
 *  own (2026-10-16, /public/subscribe), as long as every renewing product in
 *  the basket shares one interval. It must be sold on its own (purchasable)
 *  or be an optional add-on of the tier in the basket. */
export function fits(c: Catalog, b: Basket, p: PublicProduct): boolean {
  if (!has(p.price_cents)) return false;
  const tier = tierOf(c, b);
  const asOption = !!tier && (tier.optional_product_ids ?? []).includes(p.id);
  if (!p.purchasable && !asOption) return false;
  const iv = p.price_interval ?? 'once';
  if (iv === 'once') return true;
  if (tier) return iv === b.interval;
  const other = basketProductInterval(c, b, p.id);
  return other === null || other === iv;
}

/** Why a product cannot be added right now — for the button's words. */
export function addBlocker(c: Catalog, b: Basket, p: PublicProduct): 'needs_membership' | 'other_interval' | null {
  if (fits(c, b, p)) return null;
  const iv = p.price_interval ?? 'once';
  // Not sold on its own: only with the membership it belongs to.
  if (!p.purchasable) return 'needs_membership';
  if (iv !== 'once') return 'other_interval';
  return 'needs_membership';
}

/** Drop what no longer belongs: unknown ids (a stale stored basket), a tier
 *  no longer offered, products that do not fit (after removing the tier or
 *  switching the interval). Never adds anything. */
export function normalize(c: Catalog, b: Basket): Basket {
  const tier = tierOf(c, b);
  const intervals = tier ? intervalsOf(tier) : [];
  const interval: Interval = tier ? (intervals.includes(b.interval) ? b.interval : intervals[0] ?? 'year') : b.interval;
  const next: Basket = { tierId: tier && intervals.length ? tier.id : null, interval, productIds: [] };
  const seen = new Set<string>();
  for (const id of b.productIds) {
    const p = c.products.find((x) => x.id === id);
    if (!p || seen.has(id) || !fits(c, next, p)) continue;
    // A product the tier already INCLUDES is not bought again.
    if (tier && tier.product_ids.includes(id)) continue;
    seen.add(id);
    next.productIds.push(id);
  }
  return next;
}

/** ONE membership per basket: another tier replaces it. */
export const addTier = (c: Catalog, b: Basket, tierId: string): Basket => normalize(c, { ...b, tierId });
export const removeTier = (c: Catalog, b: Basket): Basket => normalize(c, { ...b, tierId: null });
export const setInterval_ = (c: Catalog, b: Basket, interval: Interval): Basket => normalize(c, { ...b, interval });
export const addProduct = (c: Catalog, b: Basket, id: string): Basket => normalize(c, { ...b, productIds: [...b.productIds, id] });
export const removeProduct = (c: Catalog, b: Basket, id: string): Basket => normalize(c, { ...b, productIds: b.productIds.filter((x) => x !== id) });

/** With a tier in the basket: its optional add-ons that fit and are not in
 *  yet — offered under it as suggestions. */
export function suggestions(c: Catalog, b: Basket): PublicProduct[] {
  const tier = tierOf(c, b);
  if (!tier) return [];
  return (tier.optional_product_ids ?? [])
    .map((id) => c.products.find((p) => p.id === id))
    .filter((p): p is PublicProduct => !!p && !b.productIds.includes(p.id) && fits(c, b, p));
}

export type Line = { kind: 'tier' | 'product'; id: string; name: string; netCents: number; currency: string; recurring: boolean };

/** The basket's lines at the viewer's country (the tier through the price
 *  logic the charge uses), each NET. */
export function lines(c: Catalog, b: Basket, country: string): Line[] {
  const out: Line[] = [];
  const tier = tierOf(c, b);
  if (tier) {
    const base = (b.interval === 'year' ? tier.price_cents_year : tier.price_cents_month) ?? 0;
    const logic = (tier as PublicTier & { price_logic?: PriceLogic | null }).price_logic ?? c.priceLogic;
    const pct = evaluatePriceLogic(logic, { country: country || null, interval: b.interval }).pct;
    out.push({ kind: 'tier', id: tier.id, name: tier.name, netCents: netOf(c, applyPct(base, pct), tier.price_includes_vat), currency: tier.currency ?? 'EUR', recurring: true });
  }
  for (const id of b.productIds) {
    const p = c.products.find((x) => x.id === id)!;
    out.push({ kind: 'product', id, name: p.name, netCents: netOf(c, p.price_cents ?? 0, p.price_includes_vat), currency: p.currency ?? 'EUR', recurring: (p.price_interval ?? 'once') !== 'once' });
  }
  return out;
}

export type Totals = {
  netCents: number;
  vatCents: number;
  grossCents: number;
  /** What comes back every period: the membership and what renews with it. */
  renewNetCents: number;
  renewGrossCents: number;
};

/** Subtotal excl. VAT, VAT at the rate (0 for a reverse charge or outside
 *  the EU), total — and the renewal, the same way. `discountCents` comes off
 *  the membership line only (a code applies to the membership). */
export function totals(ls: Line[], ratePct: number, discountCents = 0): Totals {
  const net = ls.reduce((s, l) => s + l.netCents, 0) - discountCents;
  const renewNet = ls.filter((l) => l.recurring).reduce((s, l) => s + l.netCents, 0);
  // Per line, as Stripe taxes per line — so the shown VAT is the charged VAT.
  const vat =
    ls.reduce((s, l) => s + vatOn(l.netCents - (l.kind === 'tier' ? discountCents : 0), ratePct), 0);
  const renewVat = ls.filter((l) => l.recurring).reduce((s, l) => s + vatOn(l.netCents, ratePct), 0);
  return { netCents: net, vatCents: vat, grossCents: net + vat, renewNetCents: renewNet, renewGrossCents: renewNet + renewVat };
}

/** What the checkout posts — and to which route.
 *
 *  A basket with a membership is a JOIN: every product rides it.
 *  Products only, one of them renewing, is a SUBSCRIBE (2026-10-16).
 *  Products only, none renewing, is a BUY. One product goes as `product_id` alone, which an
 *  API one release behind still understands; several as `product_ids`,
 *  which that older API refuses (400) rather than quietly buying one of them
 *  — never a silent partial purchase. */
export function checkoutTarget(b: Basket, c?: Catalog):
  | { route: '/api/v1/membership/public/join'; body: { tier_id: string; interval: Interval; option_product_ids?: string[] } }
  | { route: '/api/v1/membership/public/buy'; body: { product_id: string } | { product_ids: string[] } }
  | { route: '/api/v1/membership/public/subscribe'; body: { product_ids: string[] } }
  | null {
  if (b.tierId) {
    return {
      route: '/api/v1/membership/public/join',
      body: { tier_id: b.tierId, interval: b.interval, ...(b.productIds.length ? { option_product_ids: b.productIds } : {}) },
    };
  }
  // No membership, but something renews: a SUBSCRIPTION of its own
  // (2026-10-16). Every product goes along — a one-off as a first-invoice line.
  if (c && b.productIds.length && basketProductInterval(c, b) !== null) {
    return { route: '/api/v1/membership/public/subscribe', body: { product_ids: b.productIds } };
  }
  if (b.productIds.length === 1) return { route: '/api/v1/membership/public/buy', body: { product_id: b.productIds[0]! } };
  if (b.productIds.length > 1) return { route: '/api/v1/membership/public/buy', body: { product_ids: b.productIds } };
  return null;
}

/** The country the page starts with (Sjoerd: "recognize where people are
 *  from and preselect the country... they can refine it"). A choice the
 *  viewer made wins; then a restore (?cancelled=/?tier= carrying one); then
 *  the edge's guess; else nothing. Only a code in the list counts. */
export function initialCountry(input: { stored?: string | null; restore?: string | null; header?: string | null }, valid: ReadonlySet<string>): string {
  for (const c of [input.stored, input.restore, input.header]) {
    const code = (c ?? '').trim().toUpperCase();
    if (code && valid.has(code)) return code;
  }
  return '';
}

/** A stored basket, read defensively: anything malformed is an empty one. */
export function parseStored(raw: string | null | undefined): Basket {
  try {
    const v = JSON.parse(raw ?? '') as Partial<Basket>;
    return {
      tierId: typeof v.tierId === 'string' ? v.tierId : null,
      interval: v.interval === 'month' ? 'month' : 'year',
      productIds: Array.isArray(v.productIds) ? v.productIds.filter((x): x is string => typeof x === 'string').slice(0, 20) : [],
    };
  } catch {
    return EMPTY_BASKET;
  }
}
