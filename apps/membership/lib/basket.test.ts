import { describe, expect, it } from 'vitest';
import {
  EMPTY_BASKET,
  addProduct,
  addTier,
  checkoutTarget,
  initialCountry,
  lines,
  normalize,
  parseStored,
  removeTier,
  setInterval_,
  suggestions,
  totals,
  type Catalog,
} from './basket';
import type { PublicProduct, PublicTier } from './public-api';

const tier = (o: Partial<PublicTier> & { id: string }): PublicTier =>
  ({ name: o.id, description: null, characteristics: null, price_cents_year: 30000, price_cents_month: 3000, currency: 'EUR', sort_order: 0, product_ids: [], optional_product_ids: [], ...o }) as PublicTier;
const product = (o: Partial<PublicProduct> & { id: string }): PublicProduct =>
  ({ name: o.id, description: null, characteristics: null, price_cents: 1000, price_interval: 'once', currency: 'EUR', purchasable: true, links: null, sort_order: 0, ...o }) as PublicProduct;

const c: Catalog = {
  tiers: [
    tier({ id: 'member', optional_product_ids: ['sheet', 'coach'], product_ids: ['agenda'] }),
    tier({ id: 'fellow', price_cents_month: null, price_cents_year: 200000 }),
  ],
  products: [
    product({ id: 'sheet', price_cents: 5000, price_interval: 'year', purchasable: false }),
    product({ id: 'coach', price_cents: 900, price_interval: 'month', purchasable: false }),
    product({ id: 'workshop', price_cents: 8000 }),
    product({ id: 'retreat', price_cents: 20000 }),
    product({ id: 'agenda', price_cents: 0 }),
    product({ id: 'yearly-solo', price_cents: 4000, price_interval: 'year', purchasable: true }),
  ],
  priceLogic: null,
};

describe('the page basket', () => {
  it('one membership: another tier replaces it', () => {
    let b = addTier(c, EMPTY_BASKET, 'member');
    b = addTier(c, b, 'fellow');
    expect(b.tierId).toBe('fellow');
  });

  it('a tier only sold yearly forces the yearly interval', () => {
    const b = addTier(c, { ...EMPTY_BASKET, interval: 'month' }, 'fellow');
    expect(b.interval).toBe('year');
  });

  it('an add-on of the tier fits at its interval; removing the tier drops it, keeps one-offs', () => {
    let b = addTier(c, EMPTY_BASKET, 'member');
    b = addProduct(c, b, 'sheet');
    b = addProduct(c, b, 'workshop');
    expect(b.productIds).toEqual(['sheet', 'workshop']);
    b = removeTier(c, b);
    expect(b.productIds).toEqual(['workshop']);
  });

  it('switching to monthly drops the yearly add-on (one interval per subscription)', () => {
    let b = addProduct(c, addTier(c, EMPTY_BASKET, 'member'), 'sheet');
    b = setInterval_(c, b, 'month');
    expect(b.productIds).toEqual([]);
  });

  it('a recurring product cannot be bought without a membership', () => {
    expect(addProduct(c, EMPTY_BASKET, 'yearly-solo').productIds).toEqual([]);
    expect(addProduct(c, addTier(c, EMPTY_BASKET, 'member'), 'yearly-solo').productIds).toEqual(['yearly-solo']);
  });

  it('suggests the tier’s add-ons that fit and are not in yet', () => {
    const b = addTier(c, EMPTY_BASKET, 'member');
    expect(suggestions(c, b).map((p) => p.id)).toEqual(['sheet']);
    expect(suggestions(c, addProduct(c, b, 'sheet'))).toEqual([]);
    expect(suggestions(c, setInterval_(c, b, 'month')).map((p) => p.id)).toEqual(['coach']);
  });

  it('a stale stored basket loses what no longer exists, and never gains anything', () => {
    const b = normalize(c, { tierId: 'gone', interval: 'year', productIds: ['workshop', 'nope', 'workshop', 'agenda'] });
    expect(b).toEqual({ tierId: null, interval: 'year', productIds: ['workshop'] });
    expect(parseStored('not json')).toEqual(EMPTY_BASKET);
    expect(parseStored(JSON.stringify({ tierId: 'member', interval: 'month', productIds: ['a', 1] }))).toEqual({ tierId: 'member', interval: 'month', productIds: ['a'] });
  });

  it('totals: excl., VAT per line, incl.; the renewal is what recurs', () => {
    const b = addProduct(c, addProduct(c, addTier(c, EMPTY_BASKET, 'member'), 'sheet'), 'workshop');
    const t = totals(lines(c, b, 'NL'), 21);
    expect(t).toEqual({ netCents: 43000, vatCents: 9030, grossCents: 52030, renewNetCents: 35000, renewGrossCents: 42350 });
    expect(totals(lines(c, b, 'NL'), 0).vatCents).toBe(0); // reverse charge / outside the EU
  });

  it('a code comes off the membership line only', () => {
    const b = addProduct(c, addTier(c, EMPTY_BASKET, 'member'), 'workshop');
    const t = totals(lines(c, b, 'NL'), 21, 15000);
    expect(t.netCents).toBe(23000);
    expect(t.vatCents).toBe(Math.round(15000 * 0.21) + Math.round(8000 * 0.21));
  });

  it('checkout: a membership joins; one product buys as product_id; several as product_ids', () => {
    const withTier = addProduct(c, addTier(c, EMPTY_BASKET, 'member'), 'workshop');
    expect(checkoutTarget(withTier)).toEqual({ route: '/api/v1/membership/public/join', body: { tier_id: 'member', interval: 'year', option_product_ids: ['workshop'] } });
    expect(checkoutTarget(addProduct(c, EMPTY_BASKET, 'workshop'))!.body).toEqual({ product_id: 'workshop' });
    expect(checkoutTarget(addProduct(c, addProduct(c, EMPTY_BASKET, 'workshop'), 'retreat'))!.body).toEqual({ product_ids: ['workshop', 'retreat'] });
    expect(checkoutTarget(EMPTY_BASKET)).toBeNull();
  });
});

describe('the initial country', () => {
  const valid = new Set(['NL', 'BE', 'DE']);
  it('stored > restore > header > empty', () => {
    expect(initialCountry({ stored: 'BE', restore: 'DE', header: 'NL' }, valid)).toBe('BE');
    expect(initialCountry({ restore: 'DE', header: 'NL' }, valid)).toBe('DE');
    expect(initialCountry({ header: 'nl' }, valid)).toBe('NL');
    expect(initialCountry({}, valid)).toBe('');
  });
  it('an unknown code is ignored, not trusted', () => {
    expect(initialCountry({ stored: 'XX', header: 'ZZ' }, valid)).toBe('');
    expect(initialCountry({ stored: 'XX', header: 'DE' }, valid)).toBe('DE');
  });
});
