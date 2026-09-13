import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner } from '@thefibre/shared/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import {
  Bands,
  isAxis,
  visibleAxes,
  type Axis,
  type AxisConfig,
  type Band,
  type BandLabels,
  type Moved,
} from './bands';
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

  // The vocabulary read comes FIRST, and on purpose, because which axis to
  // show depends on it: a workspace can now switch an axis off, and the
  // default has to be one it actually reads. This costs one API hop before
  // the numbers start — deliberately, and it is the only ordering that does
  // not either show a hidden axis by default or guess and then correct
  // itself on screen.
  //
  // It still cannot blank the page. A failure here falls through to
  // undefined, every band and title falls back to its shipped translation,
  // and all five axes are visible — which is exactly the day-one state, so
  // the failure mode is the default rather than an error.
  const config = await apiFetch<{ labels: BandLabels; axes: AxisConfig }>(
    '/api/v1/connections/labels',
  ).catch(() => undefined);
  const labels: BandLabels | undefined = config?.labels;
  const axisConfig: AxisConfig | undefined = config?.axes;
  const shown = visibleAxes(axisConfig);

  // An unknown axis falls back rather than 404s — a stale bookmark should
  // still show the landscape. So does a bookmark naming an axis this
  // workspace has since switched off: it is not an error, it is a reading
  // they stopped using, and the first one they DO use is the honest answer.
  const axis: Axis = isAxis(raw) && shown.includes(raw) ? raw : (shown[0] ?? 'maturity');

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

      <AxisPicker axis={axis} locale={locale} axes={shown} config={axisConfig} />

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
          labels={labels}
          locale={locale}
        />
      )}
    </PageContainer>
  );
}
