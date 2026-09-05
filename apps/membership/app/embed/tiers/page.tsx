import { Check } from 'lucide-react';
import { appUrl } from '@thefibre/shared';
import { fetchCatalog, PublicApiError, type PublicCatalog } from '@/lib/public-api';
import { money } from '@/lib/money';
import { isLocale, t, toLocale, type Locale } from '@/lib/i18n';

// Tier cards grid for iframes — ?workspace=<slug>. No page chrome; every
// element carries a stable me-* class so embedders can restyle via the
// css-injector. "Join" escapes the frame to the public join page.
//
// ?lang= (validated) wins, else the workspace's own page language from the
// catalog, else English. ?theme is accepted but ignored — embeds always
// render light (see ../layout.tsx), like the Thread's.

export default async function EmbedTiersPage({
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

  let catalog: PublicCatalog;
  try {
    catalog = await fetchCatalog(workspaceSlug);
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) {
      return (
        <p className="me-error text-sm text-ink-subtle">
          {t(langParam, 'community_not_found')}
        </p>
      );
    }
    throw e;
  }

  const locale: Locale = langParam ?? toLocale(catalog?.locale ?? null);

  const { tiers, products } = catalog;
  const productNames = new Map(products.map((p) => [p.id, p.name]));
  // Propagate an explicitly requested language to the join page; without
  // ?lang the join page resolves the same workspace language on its own.
  const langQuery = langParam ? `&lang=${langParam}` : '';
  const joinBase = `${appUrl('membership', process.env)}/${encodeURIComponent(workspaceSlug)}`;

  if (tiers.length === 0) {
    return <p className="me-empty text-sm text-ink-subtle">{t(locale, 'no_tiers_short')}</p>;
  }

  const cols = tiers.length === 1 ? 'sm:grid-cols-1' : tiers.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className={`me-grid grid grid-cols-1 gap-4 ${cols}`}>
      {tiers.map((tier) => {
        const currency = tier.currency ?? 'EUR';
        const hasYear = tier.price_cents_year != null && tier.price_cents_year > 0;
        const hasMonth = tier.price_cents_month != null && tier.price_cents_month > 0;
        const included = tier.product_ids
          .map((id) => productNames.get(id))
          .filter((n): n is string => Boolean(n));
        return (
          <div
            key={tier.id}
            className="me-card flex flex-col rounded-xl border border-line bg-surface-raised p-5"
          >
            <h2 className="me-title text-base font-medium">{tier.name}</h2>
            <div className="me-price mt-1.5 flex items-baseline gap-1.5">
              {hasYear ? (
                <>
                  <span className="me-price-amount text-xl font-semibold tabular-nums">
                    {money(tier.price_cents_year!, currency)}
                  </span>
                  <span className="me-price-interval text-sm text-ink-subtle">
                    {t(locale, 'per_year')}
                  </span>
                </>
              ) : hasMonth ? (
                <>
                  <span className="me-price-amount text-xl font-semibold tabular-nums">
                    {money(tier.price_cents_month!, currency)}
                  </span>
                  <span className="me-price-interval text-sm text-ink-subtle">
                    {t(locale, 'per_month')}
                  </span>
                </>
              ) : (
                <span className="me-price-interval text-sm text-ink-subtle">
                  {t(locale, 'price_on_request')}
                </span>
              )}
            </div>
            {hasYear && hasMonth && (
              <div className="me-price-alt mt-0.5 text-xs text-ink-muted">
                {t(locale, 'or_month', { price: money(tier.price_cents_month!, currency) })}
              </div>
            )}
            {tier.description && (
              <p className="me-desc mt-2.5 text-sm text-ink-subtle leading-relaxed">
                {tier.description}
              </p>
            )}
            {(tier.characteristics?.length ?? 0) > 0 && (
              <ul className="me-features mt-3 space-y-1.5">
                {tier.characteristics!.map((ch, i) => (
                  <li key={i} className="me-feature flex items-start gap-2 text-sm text-ink-subtle">
                    <Check
                      size={14}
                      strokeWidth={2}
                      className="me-feature-icon mt-0.5 shrink-0 text-emerald-600"
                    />
                    {ch}
                  </li>
                ))}
              </ul>
            )}
            {included.length > 0 && (
              <div className="me-includes mt-3">
                <div className="me-includes-label text-[10px] uppercase tracking-wider text-ink-muted">
                  {t(locale, 'includes')}
                </div>
                <ul className="me-includes-list mt-1 space-y-0.5">
                  {included.map((name) => (
                    <li key={name} className="me-includes-item text-sm text-ink-subtle">
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-auto pt-4">
              <a
                href={`${joinBase}?tier=${encodeURIComponent(tier.id)}${langQuery}`}
                target="_top"
                className="me-btn inline-flex w-full items-center justify-center rounded-md bg-ink px-4 h-9 text-sm font-medium text-ink-inverse hover:opacity-90"
              >
                {t(locale, 'join')}
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
