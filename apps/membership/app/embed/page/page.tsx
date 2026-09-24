import { fetchCatalog, PublicApiError } from '@/lib/public-api';
import { isLocale, t, toLocale, type Locale } from '@/lib/i18n';
import { TierGrid } from '../../[workspaceSlug]/tier-grid';
import { ProductGrid } from '../../[workspaceSlug]/product-grid';

// The WHOLE join page, for a host website — headline, intro, tiers and
// à-la-carte products, with no page chrome (Sjoerd, 2026-09-24: an embed
// "for the page and cards (separately)").
//
// It renders the SAME components as the public page rather than a parallel
// copy: `TierGrid` and `ProductGrid` are imported from `[workspaceSlug]/`,
// so a change to how a tier reads lands in both places at once. What this
// route drops is exactly what a host page already provides — the background,
// the outer padding, and the "powered by" footer.
//
// Checkout escapes the iframe on click (shared/checkout-redirect): Stripe
// refuses to be framed, so without that the visitor's click would blank the
// widget instead of taking their money.

export default async function EmbedJoinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const workspaceSlug = typeof sp.workspace === 'string' ? sp.workspace : null;
  const langParam = typeof sp.lang === 'string' && isLocale(sp.lang) ? sp.lang : null;
  if (!workspaceSlug) {
    return <p className="me-error text-sm text-ink-subtle">Missing ?workspace=&lt;slug&gt;.</p>;
  }

  let catalog;
  try {
    catalog = await fetchCatalog(workspaceSlug);
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) {
      return (
        <p className="me-error text-sm text-ink-subtle">{t(langParam, 'community_not_found')}</p>
      );
    }
    throw e;
  }

  const { workspace, tiers, products } = catalog;
  const locale: Locale = langParam ?? toLocale(catalog?.locale ?? null);
  const joinPage = (catalog.join_page ?? {}) as { headline?: string; intro?: string };
  const headline =
    typeof joinPage.headline === 'string' && joinPage.headline.trim()
      ? joinPage.headline
      : t(locale, 'join_headline', { name: workspace.name });
  const intro = typeof joinPage.intro === 'string' && joinPage.intro.trim() ? joinPage.intro : null;

  return (
    <div className="me-page">
      <h1 className="me-headline text-2xl font-medium tracking-tight text-center">{headline}</h1>
      {intro && (
        <p className="me-intro mx-auto mt-3 max-w-2xl text-base text-ink-subtle leading-relaxed text-center whitespace-pre-line">
          {intro}
        </p>
      )}
      {tiers.length === 0 ? (
        <p className="me-empty mt-10 text-center text-sm text-ink-subtle">{t(locale, 'no_tiers')}</p>
      ) : (
        <TierGrid
          workspaceSlug={workspace.slug}
          tiers={tiers}
          products={products}
          initialTierId={null}
          priceLogic={catalog.price_logic ?? null}
          locale={locale}
        />
      )}
      <ProductGrid workspaceSlug={workspace.slug} products={products} locale={locale} />
    </div>
  );
}
