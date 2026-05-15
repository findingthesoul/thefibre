import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  SectionLabel,
} from '@/components/ui/page';
import { MeetingTypeForm, type MeetingTypeFormValues, type TeamOption } from '../form';
import { AssigneesEditor, type TeamMember, type Assignee } from './assignees';

type MT = MeetingTypeFormValues & {
  id: string;
  team_id: string | null;
  event_type: string;
};
type Team = {
  id: string;
  name: string;
  my_role: 'lead' | 'member';
};
type TeamDetail = {
  id: string;
  members: {
    role: 'lead' | 'member';
    user: TeamMember | TeamMember[] | null;
  }[];
  my_role: 'lead' | 'member' | null;
};

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

  const showAssignees =
    !!mt.team_id && (mt.event_type === 'round_robin' || mt.event_type === 'collective');

  let members: TeamMember[] = [];
  let assignees: Assignee[] = [];
  let isLead = false;
  if (showAssignees && mt.team_id) {
    try {
      const [team, asg] = await Promise.all([
        apiFetch<TeamDetail>(`/api/v1/meet/teams/${mt.team_id}`),
        apiFetch<{ items: Assignee[] }>(
          `/api/v1/meet/meeting-types/${mt.id}/assignees`,
        ),
      ]);
      isLead = team.my_role === 'lead';
      members = team.members
        .map((m) => (Array.isArray(m.user) ? m.user[0] : m.user))
        .filter((u): u is TeamMember => !!u);
      assignees = asg.items;
    } catch {
      // Non-fatal; just hide the editor.
    }
  }

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/meeting-types" label="Meeting types" />
      <PageHeader title={mt.name!} description={`slug: ${mt.slug}`} />
      <div className="mt-10">
        <MeetingTypeForm initial={mt} teams={teams} />
      </div>
      {showAssignees && isLead && (
        <section className="mt-14">
          <SectionLabel>Assignees</SectionLabel>
          <p className="mt-2 text-sm text-ink-subtle max-w-2xl">
            {mt.event_type === 'round_robin'
              ? 'Bookings rotate to the least-loaded assignee free at the requested slot. Mark one assignee as primary — they own the canonical calendar event.'
              : 'All assignees attend every booking. Slots are computed by intersecting availability. The primary holds the canonical calendar event.'}
          </p>
          <div className="mt-4">
            <AssigneesEditor
              mtId={mt.id}
              members={members}
              assignees={assignees}
            />
          </div>
        </section>
      )}
    </PageContainer>
  );
}
