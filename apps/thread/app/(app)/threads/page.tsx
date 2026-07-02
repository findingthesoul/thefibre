import { apiFetch, ApiError } from '@/lib/api';
import type { ThreadRow, TeamOption } from '@/lib/thread-types';
import { PageContainer, PageHeader, ErrorBanner } from '@/components/ui/page';
import { ThreadsList } from './threads-list';
import { NewThreadButton } from './new-thread-button';

export default async function ThreadsPage() {
  let threads: ThreadRow[] = [];
  let teams: TeamOption[] = [];
  let templates: { id: string; title: string }[] = [];
  let error: string | null = null;
  try {
    const [t, tm, tpl] = await Promise.all([
      apiFetch<{ items: ThreadRow[] }>('/api/v1/thread/threads'),
      apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams').catch(() => ({
        items: [] as TeamOption[],
      })),
      apiFetch<{ items: { id: string; title: string }[] }>(
        '/api/v1/thread/thread-templates',
      ).catch(() => ({ items: [] as { id: string; title: string }[] })),
    ]);
    threads = t.items;
    teams = tm.items;
    templates = tpl.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <PageHeader
        title="Threads"
        description="Events and journeys — each thread carries its own engagements, enrolments and certificate."
        actions={<NewThreadButton templates={templates} />}
      />

      {error && <ErrorBanner>Couldn&apos;t load threads: {error}</ErrorBanner>}

      {!error && <ThreadsList threads={threads} teams={teams} />}
    </PageContainer>
  );
}
