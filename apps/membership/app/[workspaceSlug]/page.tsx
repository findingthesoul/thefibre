import { ENTITY, appName } from '@thefibre/shared';
import { notFound } from 'next/navigation';
import { fetchCatalog, PublicApiError, type PublicCatalog } from '@/lib/public-api';
import { isLocale, t, toLocale, type Locale } from '@/lib/i18n';
import { surfaceUrl } from '@thefibre/shared';
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

  // AN UNLISTED TIER, REACHED BY ITS LINK (2026-10-14).
  //
  // `?tier=` already existed, to PRESELECT one of the tiers on the page, and
  // that must keep working exactly as it did — so the catalogue is fetched
  // whole first and the single-tier call is only a FALLBACK, for an id the
  // list does not contain. Narrowing the fetch whenever `?tier=` is present
  // would have turned every existing preselect link into a one-tier page,
  // which is a behaviour change nobody asked for.
  //
  // When the id IS unlisted, the page shows that tier alone: putting a
  // private price in the public list is the thing this feature exists to
  // avoid, and the link may be forwarded.
  let unlistedOnly = false;
  if (initialTierId && !catalog.tiers.some((t) => t.id === initialTierId)) {
    try {
      const one = await fetchCatalog(workspaceSlug, initialTierId);
      if (one.tiers.length) {
        catalog = one;
        unlistedOnly = true;
      }
      // No tiers back means archived, another community's, or simply gone.
      // The page then renders the ordinary catalogue it already has, which
      // is the honest answer to a stale invitation — not an error.
    } catch (e) {
      // A failed second call must not take down a page that already loaded.
      if (!(e instanceof PublicApiError)) throw e;
    }
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
          // LEFT INSIDE A CENTRED COLUMN (Sjoerd, 2026-10-14). The column stays
          // centred — `mx-auto max-w-2xl` — and only the text aligns left.
          // This is the community's own prose, several paragraphs of it, and
          // centring it gives every line a ragged left edge to find.
          <p className="mx-auto mt-3 max-w-2xl text-base text-ink-subtle leading-relaxed text-left whitespace-pre-line">
            {intro}
          </p>
        )}

        {cancelled && (
          <div className="mx-auto mt-6 max-w-lg rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {t(locale, 'checkout_cancelled')}
          </div>
        )}

        {/* SAY WHAT THIS IS. Somebody who opens an invitation is looking at a
            price that is not on offer to everybody, and a page that said
            nothing would let them believe it was the public one — then wonder
            why they cannot find it again, or forward it as though they could.
            Only shown for a tier reached by its link, never for the ordinary
            page. */}
        {unlistedOnly && (
          <p className="mx-auto mt-6 max-w-lg rounded-lg border border-line bg-surface px-4 py-3 text-center text-sm text-ink-subtle">
            {t(locale, 'tier_by_invitation')}
          </p>
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
            vatRegistered={catalog.vat_registered === true}
            vatHomeRatePct={catalog.vat_home_rate_pct ?? null}
            locale={locale}
            workspaceName={workspace.name}
            // Where "Show me in …" points: this community's members area on
            // my.thread — the participant's own portal, not the Members app.
            // Resolved server-side from the environment, like every other
            // cross-surface link.
            membersAreaUrl={`${surfaceUrl('my-portal', process.env)}/members/${workspace.slug}`}
            // Which terms this community asks a joiner to accept — its own if
            // it set one, The Thread's standard ones otherwise. The API
            // decides; the page only shows what it was told.
            terms={catalog.terms ?? { url: '', standard: true }}
          />
        )}

        {/* À-la-carte products — renders nothing when no product is purchasable. */}
        <ProductGrid workspaceSlug={workspace.slug} products={products} locale={locale} vatRegistered={catalog.vat_registered === true} vatHomeRatePct={catalog.vat_home_rate_pct ?? null} groups={catalog.product_groups ?? []} />

        <footer className="mt-16 text-xs text-ink-muted text-center">
          {t(locale, 'powered_by')} <span className="font-medium">{appName('membership')}</span> · {ENTITY.publicName}
        </footer>
      </main>
    </div>
  );
}
