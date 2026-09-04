import { apiFetch } from '@/lib/api';
import { workspaceCurrencies } from '@/lib/workspace-currency';
import { ProductsClient } from './products-client';
import type { Product } from './types';

export const metadata = { title: 'Products · Membership' };

export default async function ProductsPage() {
  let products: Product[] = [];
  try {
    // archived=true so the "Show archived" chip works without a refetch.
    const r = await apiFetch<{ items: Product[] }>('/api/v1/membership/products?archived=true');
    products = r.items;
  } catch {
    /* empty state below */
  }

  const currency = await workspaceCurrencies();

  return (
    <div className="px-6 py-10 max-w-5xl">
      <ProductsClient products={products} currency={currency} />
    </div>
  );
}
