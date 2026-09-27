import {
  PageContainer,
  Breadcrumb,
  PageHeader,
} from '@/components/ui/page';
import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { MeetingTypeForm, type TeamOption, type CalendarOption } from '../form';
import { EVENT_TYPES } from '@/components/event-type-picker';

type Team = { id: string; slug: string; name: string; my_role: 'lead' | 'member' };
type Host = { slug: string; zoom_connected?: boolean };

export default async function NewMeetingTypePage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; event_type?: string }>;
}) {
  const locale = await uiLocale();
  const { team: teamParam, event_type: eventTypeParam } = await searchParams;
  let teams: TeamOption[] = [];
  let calendars: CalendarOption[] = [];
  let hostSlug: string | null = null;
  let zoomConnected = false;
  try {
    const [t, c, h] = await Promise.all([
      apiFetch<{ items: Team[] }>('/api/v1/meet/teams'),
      apiFetch<{ items: CalendarOption[] }>('/api/v1/meet/calendars').catch(() => ({ items: [] })),
      apiFetch<Host>('/api/v1/meet/me').catch(() => null),
    ]);
    teams = t.items
      .filter((t) => t.my_role === 'lead')
      .map((t) => ({ id: t.id, name: t.name, slug: t.slug }));
    calendars = c.items;
    hostSlug = h?.slug ?? null;
    zoomConnected = !!h?.zoom_connected;
  } catch {
    // Non-fatal — falls back to personal-only.
  }

  // Validated against EVENT_TYPES, the list the "+ New" menu is built from,
  // rather than a copy of it. This WAS a copy, and it was the four values that
  // existed before one_off and poll shipped in May — so picking "Meeting poll"
  // from the menu silently opened a one-on-one form. Third place that same
  // stale list of four turned up: the other two were the database's
  // event_type CHECK and team_only_multihost, both widened on 2026-09-25.
  // One source, so a seventh event type cannot drift away from this page.
  const eventType = EVENT_TYPES.some((e) => e.value === eventTypeParam)
    ? eventTypeParam!
    : 'one_on_one';

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/meeting-types" label={t(locale, 'mt_title')} />
      <PageHeader
        title={t(locale, 'new_mt_title')}
        description={t(locale, 'new_mt_desc')}
      />
      <div className="mt-10">
        <MeetingTypeForm
          initial={{ team_id: teamParam ?? null, event_type: eventType }}
          teams={teams}
          calendars={calendars}
          hostSlug={hostSlug}
          zoomConnected={zoomConnected}
          locale={locale}
        />
      </div>
    </PageContainer>
  );
}
