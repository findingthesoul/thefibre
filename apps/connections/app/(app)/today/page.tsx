import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, ErrorBanner } from '@thefibre/shared/ui/page';
import { PageIntro } from '@thefibre/shared/ui/page-intro';
import { readPrefs } from '@/lib/prefs';
import { savePref } from '@/lib/prefs-actions';
import { uiLocale } from '@/lib/locale';
import { t, type Locale } from '@/lib/i18n-ui';
import { appUrl } from '@thefibre/shared';
import { Today } from './client';
import { HORIZONS, type Horizon, type TodayPayload } from './shape';
import { Agenda, type AgendaPayload } from './agenda';
import { TeamUpdatesPanel } from './team-updates';
import { TagCleaningNudge } from './tag-nudge';
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
  // Read on the server so a page whose explanation is switched off never
  // draws it and takes it away a frame later.
  const { intro } = await readPrefs();

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
  //
  // Since 2026-09-22 tomorrow gets one too — Sjoerd: *"can you also show
  // tomorrow (maybe even as the calendar view...)"*. The week horizons still
  // get none: a grid can draw one day, and "this week" as seven of them is a
  // different screen, not a taller one.
  const agendaOffset = horizon === 'today' ? 0 : horizon === 'tomorrow' ? 1 : null;
  const agendaPromise: Promise<AgendaPayload> =
    agendaOffset === null
      ? Promise.resolve({ connected: false, events: [] })
      : apiFetch<AgendaPayload>(
          `/api/v1/connections/agenda?days=1&whole_day=1&offset_days=${agendaOffset}`,
        ).catch(() => ({ connected: false, events: [] }));
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
      {/* Sjoerd, 2026-09-21: the explanation "should have a toggle button
          (on and off... reduce info on interface when not really needed)".
          Off is remembered, domain-wide, like the theme. */}
      <PageIntro
        shown={intro !== 'off'}
        onChange={savePref}
        showLabel={t(locale, 'today_intro_show')}
        hideLabel={t(locale, 'today_intro_hide')}
      >
        {t(locale, 'today_intro')}
      </PageIntro>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {/* The agenda sits INSIDE Today, directly under the day selector —
          Sjoerd, 2026-09-21: "I like that the day selection at the top". It
          is still above what you owe, because a meeting in an hour outranks
          a task due on Friday; only the control moved above both. When the
          rest of the page fails to load it is rendered on its own, so a
          broken read of the tasks does not take the calendar with it. */}
      {data ? (
        <Today
          data={data}
          horizon={horizon}
          locale={locale}
          personBase={personBase}
          threadBase={threadBase}
          agenda={
            <Agenda
              data={agenda}
              locale={locale}
              intl={INTL_LOCALES[locale]}
              labels={labels}
              day={horizon === 'tomorrow' ? 'tomorrow' : 'today'}
            />
          }
        />
      ) : (
        <Agenda
          data={agenda}
          locale={locale}
          intl={INTL_LOCALES[locale]}
          labels={labels}
          day={horizon === 'tomorrow' ? 'tomorrow' : 'today'}
        />
      )}

      {/* A team's updates over a period, for an update meeting — renders
          nothing at all for somebody who is in no team. */}
      <TeamUpdatesPanel locale={locale} />
      <TagCleaningNudge locale={locale} />
    </PageContainer>
  );
}
