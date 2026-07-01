import { apiFetch, ApiError } from '@/lib/api';
import type { ThreadRow, TeamOption } from '@/lib/thread-types';
import { PageContainer, PageHeader, ErrorBanner } from '@/components/ui/page';
import { ButtonLink } from '@/components/ui/button';
import { ThreadsList } from './threads-list';

export default async function ThreadsPage() {
  let threads: ThreadRow[] = [];
  let teams: TeamOption[] = [];
  let error: string | null = null;
  try {
    const [t, tm] = await Promise.all([
      apiFetch<{ items: ThreadRow[] }>('/api/v1/thread/threads'),
      apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams').catch(() => ({
        items: [] as TeamOption[],
      })),
    ]);
    threads = t.items;
    teams = tm.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <PageHeader
        title="Threads"
        description="Events and journeys — each thread carries its own engagements, enrolments and certificate."
        actions={<ButtonLink href="/threads/new">New thread</ButtonLink>}
      />

      {error && <ErrorBanner>Couldn&apos;t load threads: {error}</ErrorBanner>}

      {!error && <ThreadsList threads={threads} teams={teams} />}
    </PageContainer>
  );
}
