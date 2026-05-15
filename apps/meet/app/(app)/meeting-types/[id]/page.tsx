import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
} from '@/components/ui/page';
import { MeetingTypeForm, type MeetingTypeFormValues, type TeamOption } from '../form';

type MT = MeetingTypeFormValues & { id: string };
type Team = { id: string; name: string; my_role: 'lead' | 'member' };

export default async function EditMeetingTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let mt: MT | null = null;
  let teams: TeamOption[] = [];
  try {
    const [data, t] = await Promise.all([
      apiFetch<{ items: MT[] }>('/api/v1/meet/meeting-types'),
      apiFetch<{ items: Team[] }>('/api/v1/meet/teams').catch(() => ({ items: [] })),
    ]);
    mt = data.items.find((m) => m.id === id) ?? null;
    teams = t.items.filter((x) => x.my_role === 'lead').map((x) => ({ id: x.id, name: x.name }));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  if (!mt) notFound();

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/meeting-types" label="Meeting types" />
      <PageHeader title={mt.name!} description={`slug: ${mt.slug}`} />
      <div className="mt-10">
        <MeetingTypeForm initial={mt} teams={teams} />
      </div>
    </PageContainer>
  );
}
