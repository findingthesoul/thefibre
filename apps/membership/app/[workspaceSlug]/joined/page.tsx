import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check } from 'lucide-react';
import { fetchCatalog, PublicApiError } from '@/lib/public-api';
import { isLocale, t, toLocale, type Locale } from '@/lib/i18n';

// Success page — the Stripe Checkout success_url lands here (carrying
// ?lang=<locale> since i18n P1). ?lang wins, else the workspace's own page
// language from the catalog, else English.

export default async function JoinedPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspaceSlug } = await params;
  const sp = await searchParams;
  const langParam = typeof sp.lang === 'string' ? sp.lang : null;

  let workspaceName: string;
  let workspaceLocale: string | null = null;
  try {
    const catalog = await fetchCatalog(workspaceSlug);
    workspaceName = catalog.workspace.name;
    workspaceLocale = catalog?.locale ?? null;
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    throw e;
  }

  const locale: Locale = isLocale(langParam) ? langParam : toLocale(workspaceLocale);

  return (
    <div className="min-h-screen bg-surface-sunken">
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/10">
          <Check size={24} strokeWidth={2} className="text-emerald-700 dark:text-emerald-400" />
        </div>
        <h1 className="mt-6 text-2xl font-medium tracking-tight">
          {t(locale, 'joined_welcome', { name: workspaceName })}
        </h1>
        <p className="mt-3 text-base text-ink-subtle leading-relaxed">
          {t(locale, 'joined_active')}
        </p>
        <p className="mt-8 text-sm">
          <Link
            href="/my"
            className="text-ink-subtle hover:text-ink underline underline-offset-2"
          >
            {t(locale, 'view_membership')}
          </Link>
          <span className="mx-2 text-ink-muted">·</span>
          <Link
            href={`/${encodeURIComponent(workspaceSlug)}`}
            className="text-ink-subtle hover:text-ink underline underline-offset-2"
          >
            {t(locale, 'back_to', { name: workspaceName })}
          </Link>
        </p>
        <footer className="mt-16 text-xs text-ink-muted">
          {t(locale, 'powered_by')} <span className="font-medium">Membership</span> · The Fibre
        </footer>
      </main>
    </div>
  );
}
