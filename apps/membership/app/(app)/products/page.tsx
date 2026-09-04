import { apiFetch } from '@/lib/api';
import { workspaceCurrencies } from '@/lib/workspace-currency';
import { ProductsClient } from './products-client';
import type { Product } from './types';
import type { Grant } from '../access/types';

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
  // A thread's TITLE lives on its paired program (THREAD_SELECT embeds it) —
  // reading t.title returned undefined and the picker showed blank rows.
  type ThreadRow = {
    slug: string;
    program: { title?: string } | { title?: string }[] | null;
  };
  const threads = await apiFetch<{ items: ThreadRow[] }>('/api/v1/thread/threads')
    .then((r) =>
      r.items.map((t) => {
        const program = Array.isArray(t.program) ? t.program[0] : t.program;
        return { slug: t.slug, title: program?.title ?? t.slug };
      }),
    )
    .catch(() => [] as { slug: string; title: string }[]);
  // The product carries its access (2026-09-05) — the dialog manages the
  // grants attached to each product.
  const grants = await apiFetch<{ items: Grant[] }>('/api/v1/membership/grants')
    .then((r) => r.items)
    .catch(() => [] as Grant[]);

  return (
    <div className="px-6 py-10 max-w-5xl">
      <ProductsClient products={products} currency={currency} threadOptions={threads} grants={grants} />
    </div>
  );
}
