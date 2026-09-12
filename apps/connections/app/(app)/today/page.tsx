import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner } from '@thefibre/shared/ui/page';
import { uiLocale } from '@/lib/locale';
import { t, type Locale } from '@/lib/i18n-ui';
import { appUrl } from '@thefibre/shared';
import { Today } from './client';
import { HORIZONS, type Horizon, type TodayPayload } from './shape';
import { Agenda, type AgendaPayload } from './agenda';
import { INTL_LOCALES } from '@/lib/i18n-ui';
import type { BandLabels } from '../landscape/axes';

// Today — what I owe, and what is coming at me.
//
// The two halves look adjacent and are not (docs/connections-mobile.md §3).
// "What's next" is what I owe; every CRM has a version of it. "To prepare" is
// what is coming AT me and wants work first — derived from an upcoming
// commitment plus the STATE of the people attached to it. That second half is
// the reason this page exists, and it appears on its OWN lead time: a thread
// two weeks out, a meeting brief a day out. The API decides that; this page
// just asks for one horizon and renders what comes back.

function toHorizon(v: string | undefined): Horizon {
  return (HORIZONS as readonly string[]).includes(v ?? '') ? (v as Horizon) : 'today';
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ horizon?: string }>;
}) {
  const locale = (await uiLocale()) as Locale;
  const horizon = toHorizon((await searchParams).horizon);

  let data: TodayPayload | null = null;
  let error: string | null = null;

  // The agenda and the band names are both garnishes on this page: either can
  // fail without costing anybody the list of what they owe, which is the half
  // that has to work. Started alongside the main read so they cost no extra
  // wait, and each swallows its own failure.
  //
  // The agenda is only asked for on the TODAY horizon. "Who am I seeing" is a
  // question about today; rendering next week's calendar under a heading that
  // says today would be answering a question nobody asked.
  const agendaPromise: Promise<AgendaPayload> =
    horizon === 'today'
      ? apiFetch<AgendaPayload>('/api/v1/connections/agenda?days=1').catch(() => ({
          connected: false,
          events: [],
        }))
      : Promise.resolve({ connected: false, events: [] });
  const labelsPromise = apiFetch<{ labels: BandLabels }>('/api/v1/connections/labels')
    .then((r) => r.labels)
    .catch(() => undefined);

  try {
    data = await apiFetch<TodayPayload>(`/api/v1/connections/today?horizon=${horizon}`);
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  const agenda = await agendaPromise;
  const labels = await labelsPromise;

  // Cross-app destinations are resolved HERE, on the server. `appUrl` reads
  // the env map, and in a client component `process.env` is not an object —
  // only literal NEXT_PUBLIC_* accesses are inlined — so handing the client
  // finished base URLs is the only shape that works in both places.
  const personBase = `${appUrl('fibre-platform', process.env)}/contacts`;
  const threadBase = `${appUrl('the-thread', process.env)}/threads`;

  return (
    <PageContainer>
      <PageHeader title={t(locale, 'nav_today')} />
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t(locale, 'today_intro')}</p>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {/* Above what you owe, because it is the thing that is about to happen.
          A meeting in an hour outranks a task due on Friday. */}
      <Agenda data={agenda} locale={locale} intl={INTL_LOCALES[locale]} labels={labels} />

      {data && (
        <Today
          data={data}
          horizon={horizon}
          locale={locale}
          personBase={personBase}
          threadBase={threadBase}
        />
      )}
    </PageContainer>
  );
}
