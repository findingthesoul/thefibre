import { apiFetch } from '@/lib/api';
import { workspaceCurrencies } from '@/lib/workspace-currency';
import { uiLocale } from '@/lib/locale';
import { workspaceVatRegistered } from '@/lib/workspace-vat';
import { ProductsClient } from './products-client';
import type { Product } from './types';
import type { Grant, TeamOption } from '../access/types';
import type { DirectoryCategory } from '../settings/shared';
import type { ProductCategoryLink } from './types';

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

  // Directory categories (slice 1): the workspace's vocabulary, plus every
  // product->category link in one read — the dialog filters per product, the
  // same shape as grants above. Both fail soft: a product is still editable
  // without them, it just cannot be categorised in that render.
  const [categories, categoryLinks] = await Promise.all([
    apiFetch<{ items: DirectoryCategory[] }>('/api/v1/membership/directory/categories')
      .then((r) => r.items)
      .catch(() => [] as DirectoryCategory[]),
    apiFetch<{ items: ProductCategoryLink[] }>('/api/v1/membership/directory/product-categories')
      .then((r) => r.items)
      .catch(() => [] as ProductCategoryLink[]),
  ]);

  // The workspace's teams, for a team-calendar grant: it stores an id and has
  // to show a name, in the picker and in each product's "unlocks" line. Fails
  // soft like the reads above — an empty list hides the kind rather than
  // offering a picker with nothing in it.
  const teamOptions = await apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams')
    .then((r) => r.items)
    .catch(() => [] as TeamOption[]);

  // Product groups (2026-10-16): organising only. Fails soft to none.
  const groups = await apiFetch<{ items: import('./actions').ProductGroup[] }>('/api/v1/membership/product-groups')
    .then((r) => r.items)
    .catch(() => [] as import('./actions').ProductGroup[]);

  // The tiers, for "Offered with": which memberships a product rides as an
  // optional extra (the tier's optional links). Fails soft to none.
  const tiers = await apiFetch<{ items: { id: string; name: string; archived_at: string | null; membership_tier_product?: { product_id: string; optional: boolean }[] }[] }>(
    '/api/v1/membership/tiers?archived=true',
  )
    .then((r) => r.items)
    .catch(() => []);
  const tierOptions = tiers.filter((t) => !t.archived_at).map((t) => ({ id: t.id, name: t.name }));
  const tierLinks = tiers.flatMap((t) => (t.membership_tier_product ?? []).filter((l) => l.optional).map((l) => ({ tier_id: t.id, product_id: l.product_id })));
  // And where a tier INCLUDES the product (for the list's "Included in …").
  const tierIncludedLinks = tiers
    .filter((t) => !t.archived_at)
    .flatMap((t) => (t.membership_tier_product ?? []).filter((l) => !l.optional).map((l) => ({ tier_id: t.id, product_id: l.product_id })));

  const locale = await uiLocale();

  return (
    <div className="px-6 py-10 max-w-5xl">
      <ProductsClient
        vatRegistered={await workspaceVatRegistered()}
        products={products}
        groups={groups}
        currency={currency}
        threadOptions={threads}
        teamOptions={teamOptions}
        grants={grants}
        categories={categories}
        categoryLinks={categoryLinks}
        tierOptions={tierOptions}
        tierLinks={tierLinks}
        tierIncludedLinks={tierIncludedLinks}
        locale={locale}
      />
    </div>
  );
}
