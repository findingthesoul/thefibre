import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import {
  type ThreadRow,
  type EngagementRow,
  type ThreadMember,
  type WorkspaceMember,
  type TeamOption,
} from '@/lib/thread-types';
import { ThreadTimeline } from './timeline';

type ThreadDetail = ThreadRow & {
  engagements: EngagementRow[];
  co_organisers: ThreadMember[];
};

type OrgOption = { id: string; name: string };

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let thread: ThreadDetail;
  try {
    thread = await apiFetch<ThreadDetail>(`/api/v1/thread/threads/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const [members, teams, orgs, certTemplates] = await Promise.all([
    apiFetch<{ items: WorkspaceMember[] }>('/api/v1/thread/workspace-members').catch(() => ({
      items: [],
    })),
    apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams').catch(() => ({ items: [] })),
    apiFetch<{ items: OrgOption[] }>('/api/v1/organisations?limit=100').catch(() => ({
      items: [],
    })),
    apiFetch<{ items: { id: string; name: string }[] }>(
      '/api/v1/thread/certificate-templates',
    ).catch(() => ({ items: [] })),
  ]);

  // v3 layout: a single centred column, the thread as the main item, the
  // engagements immediately under it. No tabs.
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <ThreadTimeline
        thread={thread}
        engagements={thread.engagements}
        members={thread.co_organisers}
        workspaceMembers={members.items}
        teams={teams.items}
        organisations={orgs.items}
        certTemplates={certTemplates.items}
      />
    </div>
  );
}
