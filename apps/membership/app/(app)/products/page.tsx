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
  // ALL READS AT ONCE (2026-10-17 audit). They ran one after another — nine
  // round trips in a row — and every save on this page re-runs them through
  // router.refresh(), so the wait after Save was their SUM. None depends on
  // another, and each keeps its own soft failure.
  //
  // Internal slugs get PICKED, not typed (Sjoerd, 2026-09-05): the threads
  // feed the picker for thread-kind links. A thread's TITLE lives on its
  // paired program (THREAD_SELECT embeds it). The product carries its access
  // (grants). Directory categories (slice 1) and their product links, the
  // workspace's teams for a team-calendar grant, product groups (organising
  // only), and the tiers for "Offered with" / "Included in".
  type ThreadRow = {
    slug: string;
    program: { title?: string } | { title?: string }[] | null;
  };
  type TierRow = { id: string; name: string; archived_at: string | null; membership_tier_product?: { product_id: string; optional: boolean }[] };
  const [products, currency, threads, grants, categories, categoryLinks, teamOptions, groups, tiers, locale, vatRegistered] = await Promise.all([
    // archived=true so the "Show archived" chip works without a refetch.
    apiFetch<{ items: Product[] }>('/api/v1/membership/products?archived=true')
      .then((r) => r.items)
      .catch(() => [] as Product[]),
    workspaceCurrencies(),
    apiFetch<{ items: ThreadRow[] }>('/api/v1/thread/threads')
      .then((r) =>
        r.items.map((t) => {
          const program = Array.isArray(t.program) ? t.program[0] : t.program;
          return { slug: t.slug, title: program?.title ?? t.slug };
        }),
      )
      .catch(() => [] as { slug: string; title: string }[]),
    apiFetch<{ items: Grant[] }>('/api/v1/membership/grants')
      .then((r) => r.items)
      .catch(() => [] as Grant[]),
    apiFetch<{ items: DirectoryCategory[] }>('/api/v1/membership/directory/categories')
      .then((r) => r.items)
      .catch(() => [] as DirectoryCategory[]),
    apiFetch<{ items: ProductCategoryLink[] }>('/api/v1/membership/directory/product-categories')
      .then((r) => r.items)
      .catch(() => [] as ProductCategoryLink[]),
    apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams')
      .then((r) => r.items)
      .catch(() => [] as TeamOption[]),
    apiFetch<{ items: import('./actions').ProductGroup[] }>('/api/v1/membership/product-groups')
      .then((r) => r.items)
      .catch(() => [] as import('./actions').ProductGroup[]),
    apiFetch<{ items: TierRow[] }>('/api/v1/membership/tiers?archived=true')
      .then((r) => r.items)
      .catch(() => [] as TierRow[]),
    uiLocale(),
    workspaceVatRegistered(),
  ]);
  const tierOptions = tiers.filter((t) => !t.archived_at).map((t) => ({ id: t.id, name: t.name }));
  const tierLinks = tiers.flatMap((t) => (t.membership_tier_product ?? []).filter((l) => l.optional).map((l) => ({ tier_id: t.id, product_id: l.product_id })));
  // And where a tier INCLUDES the product (for the list's "Included in …").
  const tierIncludedLinks = tiers
    .filter((t) => !t.archived_at)
    .flatMap((t) => (t.membership_tier_product ?? []).filter((l) => !l.optional).map((l) => ({ tier_id: t.id, product_id: l.product_id })));

  return (
    <div className="px-6 py-10 max-w-5xl">
      <ProductsClient
        vatRegistered={vatRegistered}
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
