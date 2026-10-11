import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner, Breadcrumb } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t, INTL_LOCALES } from '@/lib/i18n-ui';
import { OrgDuplicatesClient, type OrgDupPair, type OrgMergeRow } from './client';

// Admin-only in the API (merging rewrites who the members belong to and which
// billing details apply). A non-admin gets a 403 here, shown as such rather
// than as an empty list — an empty queue and "you may not look" are different
// facts, and showing the first for the second is a lie that looks like calm.
export default async function OrganisationDuplicatesPage() {
  const locale = await uiLocale();

  let pairs: OrgDupPair[] = [];
  let merges: OrgMergeRow[] = [];
  let error: string | null = null;
  let forbidden = false;

  try {
    const [dups, hist] = await Promise.all([
      apiFetch<{ items: OrgDupPair[] }>('/api/v1/organisations/duplicates?limit=100'),
      apiFetch<{ items: OrgMergeRow[] }>('/api/v1/organisations/merges'),
    ]);
    pairs = dups.items;
    merges = hist.items;
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) forbidden = true;
    else error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <Breadcrumb href="/organisations" label={t(locale, 'nav_organisations')} />
      <PageHeader title={t(locale, 'dup_title')} />
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t(locale, 'odup_intro')}</p>

      {forbidden && <ErrorBanner>{t(locale, 'odup_admins_only')}</ErrorBanner>}
      {error && <ErrorBanner>{error}</ErrorBanner>}

      {!forbidden && !error && (
        <OrgDuplicatesClient
          pairs={pairs}
          merges={merges}
          locale={locale}
          intlLocale={INTL_LOCALES[locale]}
        />
      )}
    </PageContainer>
  );
}
