import {
  PageContainer,
  Breadcrumb,
  PageHeader,
} from '@/components/ui/page';
import { apiFetch } from '@/lib/api';
import { MeetingTypeForm, type TeamOption, type CalendarOption } from '../form';

type Team = { id: string; name: string; my_role: 'lead' | 'member' };

export default async function NewMeetingTypePage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; event_type?: string }>;
}) {
  const { team: teamParam, event_type: eventTypeParam } = await searchParams;
  let teams: TeamOption[] = [];
  let calendars: CalendarOption[] = [];
  try {
    const [t, c] = await Promise.all([
      apiFetch<{ items: Team[] }>('/api/v1/meet/teams'),
      apiFetch<{ items: CalendarOption[] }>('/api/v1/meet/calendars').catch(() => ({ items: [] })),
    ]);
    teams = t.items.filter((t) => t.my_role === 'lead').map((t) => ({ id: t.id, name: t.name }));
    calendars = c.items;
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
      <Breadcrumb href="/meeting-types" label="Meeting types" />
      <PageHeader
        title="New meeting type"
        description="What can people book you for?"
      />
      <div className="mt-10">
        <MeetingTypeForm
          initial={{ team_id: teamParam ?? null, event_type: eventType }}
          teams={teams}
          calendars={calendars}
        />
      </div>
    </PageContainer>
  );
}
