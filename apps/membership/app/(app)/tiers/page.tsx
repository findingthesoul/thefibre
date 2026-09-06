import { apiFetch } from '@/lib/api';
import { workspaceCurrencies } from '@/lib/workspace-currency';
import { uiLocale } from '@/lib/locale';
import { TiersClient } from './tiers-client';
import type { Tier } from './types';
import type { Product } from '../products/types';

export const metadata = { title: 'Tiers · Membership' };

export default async function TiersPage() {
  let tiers: Tier[] = [];
  let products: Product[] = [];
  try {
    // archived=true so the "Show archived" chip works without a refetch.
    const [tR, pR] = await Promise.all([
      apiFetch<{ items: Tier[] }>('/api/v1/membership/tiers?archived=true'),
      apiFetch<{ items: Product[] }>('/api/v1/membership/products?archived=true'),
    ]);
    tiers = tR.items;
    products = pR.items;
  } catch {
    /* empty state below */
  }
  const currency = await workspaceCurrencies();
  const locale = await uiLocale();

  return (
    <div className="px-6 py-10 max-w-5xl">
      <TiersClient tiers={tiers} products={products} currency={currency} locale={locale} />
    </div>
  );
}
