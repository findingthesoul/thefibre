import { apiFetch } from '@/lib/api';
import { workspaceCurrencies } from '@/lib/workspace-currency';
import { uiLocale } from '@/lib/locale';
import { TiersClient } from './tiers-client';
import type { Tier } from './types';
import type { Product, ProductCategoryLink } from '../products/types';
import type { DirectoryCategory } from '../settings/shared';

export const metadata = { title: 'Tiers · Membership' };

export default async function TiersPage() {
  let tiers: Tier[] = [];
  let products: Product[] = [];
  let categories: DirectoryCategory[] = [];
  let categoryLinks: ProductCategoryLink[] = [];
  try {
    // archived=true so the "Show archived" chip works without a refetch.
    const [tR, pR, cats, links] = await Promise.all([
      apiFetch<{ items: Tier[] }>('/api/v1/membership/tiers?archived=true'),
      apiFetch<{ items: Product[] }>('/api/v1/membership/products?archived=true'),
      // Directory categories, to SHOW what a tier confers through its
      // products (slice 1). Read-only here — categories are set on the
      // product, never on the tier, so there is one place to change them.
      apiFetch<{ items: DirectoryCategory[] }>('/api/v1/membership/directory/categories')
        .then((r) => r.items)
        .catch(() => [] as DirectoryCategory[]),
      apiFetch<{ items: ProductCategoryLink[] }>('/api/v1/membership/directory/product-categories')
        .then((r) => r.items)
        .catch(() => [] as ProductCategoryLink[]),
    ]);
    tiers = tR.items;
    products = pR.items;
    categories = cats;
    categoryLinks = links;
  } catch {
    /* empty state below */
  }
  const currency = await workspaceCurrencies();
  const locale = await uiLocale();

  return (
    <div className="px-6 py-10 max-w-5xl">
      <TiersClient
        tiers={tiers}
        products={products}
        categories={categories}
        categoryLinks={categoryLinks}
        currency={currency}
        locale={locale}
      />
    </div>
  );
}
