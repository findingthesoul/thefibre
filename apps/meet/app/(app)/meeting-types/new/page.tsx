import {
  PageContainer,
  Breadcrumb,
  PageHeader,
} from '@/components/ui/page';
import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { MeetingTypeForm, type TeamOption, type CalendarOption } from '../form';

type Team = { id: string; slug: string; name: string; my_role: 'lead' | 'member' };
type Host = { slug: string };

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
  } catch {
    // Non-fatal — falls back to personal-only.
  }

  const eventType =
    eventTypeParam &&
    ['one_on_one', 'group', 'round_robin', 'collective'].includes(eventTypeParam)
      ? eventTypeParam
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
          locale={locale}
        />
      </div>
    </PageContainer>
  );
}
