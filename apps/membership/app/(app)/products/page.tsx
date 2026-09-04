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
  // Internal slugs get PICKED, not typed (Sjoerd, 2026-09-05): offer the
  // workspace's actual threads for thread-kind links. Cross-app read on the
  // user's own RLS identity; failure just falls back to a text field.
  const threads = await apiFetch<{ items: { slug: string; title: string }[] }>(
    '/api/v1/thread/threads',
  )
    .then((r) => r.items.map((t) => ({ slug: t.slug, title: t.title })))
    .catch(() => [] as { slug: string; title: string }[]);

  return (
    <div className="px-6 py-10 max-w-5xl">
      <ProductsClient products={products} currency={currency} threadOptions={threads} />
    </div>
  );
}
