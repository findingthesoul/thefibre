import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import {
  type ThreadRow,
  type EngagementRow,
  type OrganiserCore,
} from '@/lib/thread-types';
import { ThreadTimeline } from './timeline';

type ThreadDetail = ThreadRow & {
  engagements: EngagementRow[];
  co_organisers: { role: string; organiser: OrganiserCore | OrganiserCore[] | null }[];
};

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

  // v3 layout: a single centred column, the thread as the main item, the
  // engagements immediately under it. No tabs.
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <ThreadTimeline thread={thread} engagements={thread.engagements} />
    </div>
  );
}
