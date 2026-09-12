import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner } from '@thefibre/shared/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { Bands, isAxis, type Axis, type Band, type Moved } from './bands';
import { AxisPicker } from './axis-picker';

type Landscape = {
  total: number;
  since_days: number;
  axis?: Axis;
  bands: Band[];
  arrived: number;
  moved: Moved[];
  moved_total: number;
};

// The shape of the community, as proportions rather than people. A vast
// network does not fit on a screen and would not help if it did — see
// docs/connections-mobile.md §1. The queue of who needs you is a separate
// surface with a different rhythm.
//
// One page, five readings. The axis lives in the URL rather than in component
// state so a reading can be shared and the back button works; the API
// defaults to maturity, so /landscape with no query is exactly what it was
// before the picker existed.
export default async function LandscapePage({
  searchParams,
}: {
  searchParams: Promise<{ axis?: string }>;
}) {
  const locale = await uiLocale();
  const raw = (await searchParams).axis;
  // An unknown axis falls back rather than 404s — a stale bookmark should
  // still show the landscape.
  const axis: Axis = isAxis(raw) ? raw : 'maturity';

  let data: Landscape | null = null;
  let error: string | null = null;
  try {
    data = await apiFetch<Landscape>(
      `/api/v1/connections/landscape?since_days=30&axis=${axis}`,
    );
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <PageHeader title={t(locale, 'nav_landscape')} />
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t(locale, 'landscape_intro')}</p>

      <AxisPicker axis={axis} locale={locale} />

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
          axis={axis}
          locale={locale}
        />
      )}
    </PageContainer>
  );
}
