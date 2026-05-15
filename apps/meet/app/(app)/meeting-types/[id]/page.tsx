import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
} from '@/components/ui/page';
import { MeetingTypeForm, type MeetingTypeFormValues } from '../form';

type MT = MeetingTypeFormValues & { id: string };

export default async function EditMeetingTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let mt: MT | null = null;
  try {
    const data = await apiFetch<{ items: MT[] }>('/api/v1/meet/meeting-types');
    mt = data.items.find((m) => m.id === id) ?? null;
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
        <MeetingTypeForm initial={mt} />
      </div>
    </PageContainer>
  );
}
