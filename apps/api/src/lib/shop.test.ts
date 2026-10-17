// The shop's rules (lib/shop.ts): which list a product lands in, and the ones
// it never lands in — archived, unpurchasable, unpriced, members-only renewing
// products in the open shop, anything owned, anything riding the membership.

import { describe, expect, it } from 'vitest';
import { composeShop, openShopAction, withinCap, type ShopProductRow } from './shop.js';
import { vi } from 'vitest';

const W = 'ws-1';
const p = (over: Partial<ShopProductRow>): ShopProductRow => ({
  id: 'p',
  workspace_id: W,
  name: 'P',
  description: null,
  price_cents: 1000,
  price_interval: 'once',
  currency: 'eur',
  price_includes_vat: false,
  purchasable: true,
  sold_without_membership: false,
  archived_at: null,
  ...over,
});

describe('openShopAction — mirrors /public/buy and /public/subscribe', () => {
  it('a purchasable priced one-off is bought', () => expect(openShopAction(p({}))).toBe('buy'));
  it('a renewing product opened to non-members is subscribed to', () =>
    expect(openShopAction(p({ price_interval: 'year', sold_without_membership: true }))).toBe('subscribe'));
  it('a members-only renewing product is not in the open shop', () => expect(openShopAction(p({ price_interval: 'year' }))).toBeNull());
  it('never an archived, unpurchasable, unpriced or free product', () => {
    expect(openShopAction(p({ archived_at: '2026-10-01T00:00:00Z' }))).toBeNull();
    expect(openShopAction(p({ purchasable: false }))).toBeNull();
    expect(openShopAction(p({ price_cents: null }))).toBeNull();
    expect(openShopAction(p({ price_cents: 0 }))).toBeNull();
  });
});

describe('composeShop', () => {
  const ws = { id: W, slug: 'soul', name: 'Soul' };
  const products = [
    p({ id: 'open-once', name: 'Workbook' }),
    p({ id: 'open-sub', name: 'Newsletter', price_interval: 'month', sold_without_membership: true }),
    p({ id: 'members-sub', name: 'Email', price_interval: 'year' }),
    p({ id: 'owned', name: 'Retreat' }),
    p({ id: 'archived', archived_at: '2026-10-01T00:00:00Z' }),
    p({ id: 'unpurchasable', purchasable: false }),
    p({ id: 'elsewhere', workspace_id: 'ws-2' }),
  ];
  const membersOnly = [
    { id: 'members-sub', name: 'Email', price_cents: 6000, currency: 'EUR', recurring: true, price_interval: 'year' },
    { id: 'owned', name: 'Retreat', price_cents: 1000, currency: 'EUR', recurring: false, price_interval: 'once' },
  ];
  const shop = composeShop({ workspace: ws, memberId: 'm-1', membersOnly, products, ownedIds: new Set(['owned']), canSell: true, defaultCurrency: 'eur' });

  it('members-only: the member offer, minus anything owned (already riding the membership)', () => {
    expect(shop.members_only.map((x) => [x.id, x.action])).toEqual([['members-sub', 'add_to_membership']]);
  });
  it('open: sold-alone products only, never archived or unpurchasable, never another community, never one already in members-only', () => {
    expect(shop.open.map((x) => [x.id, x.action])).toEqual([
      ['open-once', 'buy'],
      ['open-sub', 'subscribe'],
    ]);
  });
  it('owned: shown once, with whether it renews', () => {
    expect(shop.owned).toEqual([{ id: 'owned', name: 'Retreat', recurring: false }]);
  });
  it('no payment account: nothing in the open shop (its checkout would answer 503)', () => {
    const s = composeShop({ workspace: ws, memberId: null, membersOnly: [], products, ownedIds: new Set(), canSell: false, defaultCurrency: 'eur' });
    expect(s.open).toEqual([]);
  });
  it('a non-member gets no members-only list', () => {
    const s = composeShop({ workspace: ws, memberId: null, membersOnly: [], products, ownedIds: new Set(), canSell: true, defaultCurrency: 'eur' });
    expect(s.members_only).toEqual([]);
    expect(s.open.map((x) => x.id)).toEqual(['open-once', 'open-sub', 'owned']);
  });
});

describe('withinCap — one slow community cannot hold the shop page', () => {
  it('returns the value when it comes in time', async () => {
    await expect(withinCap(Promise.resolve(['x']), 50)).resolves.toEqual(['x']);
  });
  it('returns null once the cap has passed, without waiting for the slow read', async () => {
    vi.useFakeTimers();
    try {
      const slow = new Promise<string[]>((res) => setTimeout(() => res(['late']), 22_500));
      const r = withinCap(slow, 3000);
      await vi.advanceTimersByTimeAsync(3000);
      await expect(r).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('composeShop — an unread member offer is "not known", not "nothing"', () => {
  it('carries members_only_unavailable, with an empty list, so the page can say so', () => {
    const s = composeShop({ workspace: { id: 'ws-1', slug: 's', name: 'S' }, memberId: 'm', membersOnly: [], membersOnlyUnavailable: true, products: [], ownedIds: new Set(), canSell: true, defaultCurrency: 'eur' });
    expect(s.members_only).toEqual([]);
    expect(s.members_only_unavailable).toBe(true);
  });
  it('is false by default', () => {
    const s = composeShop({ workspace: { id: 'ws-1', slug: 's', name: 'S' }, memberId: 'm', membersOnly: [], products: [], ownedIds: new Set(), canSell: true, defaultCurrency: 'eur' });
    expect(s.members_only_unavailable).toBe(false);
  });
});
