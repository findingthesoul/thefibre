import { apiFetch } from '@/lib/api';
import type { OrganiserRow, TeamOption } from '@/lib/thread-types';
import { PageContainer, PageHeader, Breadcrumb } from '@/components/ui/page';
import { NewThreadForm } from './form';

export default async function NewThreadPage() {
  // Auto-provisions the organiser row on first visit; the slug feeds the
  // public-URL prefix in the form.
  const [organiser, teams] = await Promise.all([
    apiFetch<OrganiserRow>('/api/v1/thread/me'),
    apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams').catch(() => ({ items: [] })),
  ]);

  return (
    <PageContainer max="3xl">
      <Breadcrumb href="/threads" label="Threads" />
      <PageHeader
        title="New thread"
        description="An event with a schedule, or a journey that unfolds over time."
      />
      <NewThreadForm organiserSlug={organiser.slug} teams={teams.items} />
    </PageContainer>
  );
}
