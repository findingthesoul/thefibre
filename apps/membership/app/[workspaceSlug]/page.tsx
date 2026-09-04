import { notFound } from 'next/navigation';
import { fetchCatalog, PublicApiError, type PublicCatalog } from '@/lib/public-api';
import { TierGrid } from './tier-grid';

// Public join page — no auth, no sidebar. Anyone with the link sees the
// workspace's tiers and joins via Stripe Checkout.

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

  let catalog: PublicCatalog;
  try {
    catalog = await fetchCatalog(workspaceSlug);
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    throw e;
  }

  const { workspace, tiers, products, join_page: joinPage } = catalog;
  const headline =
    typeof joinPage.headline === 'string' && joinPage.headline.trim()
      ? joinPage.headline
      : `Join ${workspace.name}`;
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
            Checkout was cancelled — nothing was charged. Pick a tier below whenever
            you&apos;re ready.
          </div>
        )}

        {tiers.length === 0 ? (
          <p className="mt-12 text-center text-sm text-ink-subtle">
            No membership tiers are available yet — check back soon.
          </p>
        ) : (
          <TierGrid
            workspaceSlug={workspace.slug}
            tiers={tiers}
            products={products}
            initialTierId={initialTierId}
          />
        )}

        <footer className="mt-16 text-xs text-ink-muted text-center">
          Powered by <span className="font-medium">Membership</span> · The Fibre
        </footer>
      </main>
    </div>
  );
}
