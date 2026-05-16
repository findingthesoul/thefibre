import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  SectionLabel,
} from '@/components/ui/page';
import {
  MeetingTypeForm,
  type MeetingTypeFormValues,
  type TeamOption,
  type CalendarOption,
} from '../form';
import { AssigneesEditor, type TeamMember, type Assignee } from './assignees';
import { PollVotesMatrix } from './votes';

type MT = MeetingTypeFormValues & {
  id: string;
  team_id: string | null;
  event_type: string;
};
type Team = {
  id: string;
  slug: string;
  name: string;
  my_role: 'lead' | 'member';
};
type Host = { slug: string };
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
  let calendars: CalendarOption[] = [];
  let hostSlug: string | null = null;
  try {
    const [data, t, c, h] = await Promise.all([
      apiFetch<{ items: MT[] }>('/api/v1/meet/meeting-types'),
      apiFetch<{ items: Team[] }>('/api/v1/meet/teams').catch(() => ({ items: [] })),
      apiFetch<{ items: CalendarOption[] }>('/api/v1/meet/calendars').catch(() => ({ items: [] })),
      apiFetch<Host>('/api/v1/meet/me').catch(() => null),
    ]);
    mt = data.items.find((m) => m.id === id) ?? null;
    teams = t.items
      .filter((x) => x.my_role === 'lead')
      .map((x) => ({ id: x.id, name: x.name, slug: x.slug }));
    calendars = c.items;
    hostSlug = h?.slug ?? null;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  if (!mt) notFound();

  const showAssignees =
    !!mt.team_id && (mt.event_type === 'round_robin' || mt.event_type === 'collective');

  // Poll: fetch the candidate slots + votes so we can render the matrix and
  // seed the editor with the saved slots (so the form's PollSlotsEditor
  // doesn't show empty inputs on edit).
  type PollSlot = { starts_at: string; ends_at: string };
  type PollVote = {
    voter_email: string;
    voter_name: string;
    slot_starts_at: string;
    created_at: string;
  };
  let pollSlots: PollSlot[] = [];
  let pollVotes: PollVote[] = [];
  if (mt.event_type === 'poll') {
    try {
      const poll = await apiFetch<{ slots: PollSlot[]; votes: PollVote[] }>(
        `/api/v1/meet/meeting-types/${mt.id}/poll`,
      );
      pollSlots = poll.slots;
      pollVotes = poll.votes;
    } catch {
      // Non-fatal — just show empty matrix.
    }
  }
  // Seed the form with poll_slots so PollSlotsEditor preloads correctly.
  const initialForForm = { ...mt, poll_slots: pollSlots };

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
        <MeetingTypeForm
          initial={initialForForm}
          teams={teams}
          calendars={calendars}
          hostSlug={hostSlug}
        />
      </div>
      {mt.event_type === 'poll' && (
        <section className="mt-14">
          <SectionLabel>Votes</SectionLabel>
          <p className="mt-2 text-sm text-ink-subtle max-w-2xl">
            One row per invitee, one column per candidate slot. Tap "Confirm"
            on the winning column to convert this poll into a fixed time —
            the meeting type flips to one-off so the slot becomes bookable.
          </p>
          <div className="mt-4">
            <PollVotesMatrix mtId={mt.id} slots={pollSlots} votes={pollVotes} />
          </div>
        </section>
      )}
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
