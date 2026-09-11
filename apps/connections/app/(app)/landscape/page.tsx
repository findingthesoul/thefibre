import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner } from '@thefibre/shared/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { Bands, type Band, type Moved } from './bands';

type Landscape = {
  total: number;
  since_days: number;
  bands: Band[];
  arrived: number;
  moved: Moved[];
  moved_total: number;
};

// The shape of the community, as proportions rather than people. A vast
// network does not fit on a screen and would not help if it did — see
// docs/connections-mobile.md §1. The queue of who needs you is a separate
// surface with a different rhythm.
export default async function LandscapePage() {
  const locale = await uiLocale();

  let data: Landscape | null = null;
  let error: string | null = null;
  try {
    data = await apiFetch<Landscape>('/api/v1/connections/landscape?since_days=30');
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <PageHeader title={t(locale, 'nav_landscape')} />
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t(locale, 'landscape_intro')}</p>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {data && data.total === 0 && (
        <p className="mt-8 text-sm text-ink-muted">{t(locale, 'landscape_empty')}</p>
      )}

      {data && data.total > 0 && (
        <Bands
          bands={data.bands}
          total={data.total}
          arrived={data.arrived}
          moved={data.moved}
          movedTotal={data.moved_total}
          sinceDays={data.since_days}
          locale={locale}
        />
      )}
    </PageContainer>
  );
}
