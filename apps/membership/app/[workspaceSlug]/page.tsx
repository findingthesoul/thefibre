import { notFound } from 'next/navigation';
import { fetchCatalog, PublicApiError, type PublicCatalog } from '@/lib/public-api';
import { isLocale, t, toLocale, type Locale } from '@/lib/i18n';
import { TierGrid } from './tier-grid';
import { ProductGrid } from './product-grid';

// Public join page — no auth, no sidebar. Anyone with the link sees the
// workspace's tiers and joins via Stripe Checkout.
//
// Language: ?lang= (validated) wins, else the workspace's own page language
// from the catalog, else English.

export default async function PublicJoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspaceSlug } = await params;
  const sp = await searchParams;
  const cancelled = sp.cancelled === '1';
  const initialTierId = typeof sp.tier === 'string' ? sp.tier : null;
  const langParam = typeof sp.lang === 'string' ? sp.lang : null;

  let catalog: PublicCatalog;
  try {
    catalog = await fetchCatalog(workspaceSlug);
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    throw e;
  }

  const locale: Locale = isLocale(langParam) ? langParam : toLocale(catalog?.locale ?? null);

  const { workspace, tiers, products, join_page: joinPage } = catalog;
  const headline =
    typeof joinPage.headline === 'string' && joinPage.headline.trim()
      ? joinPage.headline
      : t(locale, 'join_headline', { name: workspace.name });
  const intro = typeof joinPage.intro === 'string' && joinPage.intro.trim() ? joinPage.intro : null;

  return (
    <div className="min-h-screen bg-surface-sunken">
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-[11px] uppercase tracking-wider text-ink-muted text-center">
          {workspace.name}
        </div>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-center">{headline}</h1>
        {intro && (
          <p className="mx-auto mt-3 max-w-2xl text-base text-ink-subtle leading-relaxed text-center whitespace-pre-line">
            {intro}
          </p>
        )}

        {cancelled && (
          <div className="mx-auto mt-6 max-w-lg rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {t(locale, 'checkout_cancelled')}
          </div>
        )}

        {tiers.length === 0 ? (
          <p className="mt-12 text-center text-sm text-ink-subtle">{t(locale, 'no_tiers')}</p>
        ) : (
          <TierGrid
            workspaceSlug={workspace.slug}
            tiers={tiers}
            products={products}
            initialTierId={initialTierId}
            priceLogic={catalog.price_logic ?? null}
            locale={locale}
          />
        )}

        {/* À-la-carte products — renders nothing when no product is purchasable. */}
        <ProductGrid workspaceSlug={workspace.slug} products={products} locale={locale} />

        <footer className="mt-16 text-xs text-ink-muted text-center">
          {t(locale, 'powered_by')} <span className="font-medium">Membership</span> · The Fibre
        </footer>
      </main>
    </div>
  );
}
