import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader } from '@thefibre/shared/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
// From axes, not bands: this is a server component, and values it reads must
// come from a module with no directive (see the header of axes.ts).
import { isAxis, visibleAxes, type Axis, type AxisConfig, type BandLabels } from './axes';
import { LandscapeColumns } from './columns';
import { loadReading } from './actions';

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
  searchParams: Promise<{ axis?: string; band?: string; person?: string }>;
}) {
  const locale = await uiLocale();
  const sp = await searchParams;
  const raw = sp.axis;

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

  // The first reading, with everybody's place on it, so the columns open on
  // something rather than on a spinner. Further readings load in the browser.
  const initialReading = await loadReading(axis);

  return (
    <PageContainer>
      <PageHeader title={t(locale, 'nav_landscape')} />
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t(locale, 'landscape_intro')}</p>

      {/* Columns, the way Finder browses a disk. Sjoerd, 2026-09-13: *"Landscape:
          would be nice if this works like 'As columns' in OsX."* This replaces
          the chip picker and the band list rather than sitting beside them:
          two ways to do the same thing would each be half-used. */}
      {initialReading.ok && initialReading.total === 0 ? (
        <p className="mt-8 text-sm text-ink-muted">{t(locale, 'landscape_empty')}</p>
      ) : (
        <LandscapeColumns
          locale={locale}
          axes={shown}
          config={axisConfig}
          labels={labels}
          initialAxis={axis}
          initialBand={sp.band?.trim() || null}
          initialPerson={sp.person?.trim() || null}
          initialReading={initialReading}
        />
      )}
    </PageContainer>
  );
}
