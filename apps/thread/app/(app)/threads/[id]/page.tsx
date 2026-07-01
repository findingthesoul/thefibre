import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import {
  one,
  type ThreadRow,
  type EngagementRow,
  type OrganiserCore,
} from '@/lib/thread-types';
import { PageContainer, PageHeader, Breadcrumb } from '@/components/ui/page';
import { ThreadEditor } from './editor';

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

  const program = one(thread.program);
  const organiser = one(thread.organiser);

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/threads" label="Threads" />
      <PageHeader
        title={program?.title ?? thread.slug}
        description={`${program?.format === 'journey' ? 'Journey' : 'Event'} · ${
          organiser?.display_name ?? organiser?.slug ?? ''
        }`}
      />
      <ThreadEditor thread={thread} engagements={thread.engagements} />
    </PageContainer>
  );
}
