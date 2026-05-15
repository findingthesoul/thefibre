import {
  PageContainer,
  Breadcrumb,
  PageHeader,
} from '@/components/ui/page';
import { apiFetch } from '@/lib/api';
import { MeetingTypeForm, type TeamOption } from '../form';

type Team = { id: string; name: string; my_role: 'lead' | 'member' };

export default async function NewMeetingTypePage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team: teamParam } = await searchParams;
  let teams: TeamOption[] = [];
  try {
    const r = await apiFetch<{ items: Team[] }>('/api/v1/meet/teams');
    teams = r.items.filter((t) => t.my_role === 'lead').map((t) => ({ id: t.id, name: t.name }));
  } catch {
    // Non-fatal — falls back to personal-only.
  }

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/meeting-types" label="Meeting types" />
      <PageHeader
        title="New meeting type"
        description="What can people book you for?"
      />
      <div className="mt-10">
        <MeetingTypeForm
          initial={{ team_id: teamParam ?? null }}
          teams={teams}
        />
      </div>
    </PageContainer>
  );
}
