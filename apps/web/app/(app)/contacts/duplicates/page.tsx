import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner, Breadcrumb } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t, INTL_LOCALES } from '@/lib/i18n-ui';
import { DuplicatesClient, type DupPair, type MergeRow } from './client';

// Admin-only in the API (merging rewrites who owns a payment and a
// certificate). A non-admin gets a 403 here, shown as such rather than as an
// empty list — an empty queue and "you may not look" are different facts.
export default async function DuplicatesPage() {
  const locale = await uiLocale();

  let pairs: DupPair[] = [];
  let merges: MergeRow[] = [];
  let error: string | null = null;
  let forbidden = false;

  try {
    const [dups, hist] = await Promise.all([
      apiFetch<{ items: DupPair[] }>('/api/v1/persons/duplicates?limit=100'),
      apiFetch<{ items: MergeRow[] }>('/api/v1/persons/merges'),
    ]);
    pairs = dups.items;
    merges = hist.items;
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) forbidden = true;
    else error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <Breadcrumb href="/contacts" label={t(locale, 'nav_contacts')} />
      <PageHeader title={t(locale, 'dup_title')} />
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t(locale, 'dup_intro')}</p>

      {forbidden && <ErrorBanner>{t(locale, 'dup_admins_only')}</ErrorBanner>}
      {error && <ErrorBanner>{error}</ErrorBanner>}

      {!forbidden && !error && (
        <DuplicatesClient
          pairs={pairs}
          merges={merges}
          locale={locale}
          intlLocale={INTL_LOCALES[locale]}
        />
      )}
    </PageContainer>
  );
}
