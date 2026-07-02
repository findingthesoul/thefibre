// Thread templates — list, edit, instantiate. Templates are captured from a
// live thread ("Save as template" in thread settings) with relative timing;
// "Use template" rebases every engagement onto the new start date.

import { apiFetch } from '@/lib/api';
import type { TeamOption } from '@/lib/thread-types';
import { PageContainer, PageHeader, Breadcrumb } from '@/components/ui/page';
import { TemplatesClient } from './templates-client';
import type { ThreadTemplate } from './actions';

export const dynamic = 'force-dynamic';

export default async function ThreadTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // ?use=<id> — arriving from the New-thread menu opens that template's
  // "Use template" dialog straight away.
  const sp = await searchParams;
  const useId = typeof sp.use === 'string' ? sp.use : null;
  const [{ items }, teams] = await Promise.all([
    apiFetch<{ items: ThreadTemplate[] }>('/api/v1/thread/thread-templates'),
    apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams')
      .then((r) => r.items)
      .catch(() => [] as TeamOption[]),
  ]);

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/templates" label="Templates" />
      <PageHeader
        title="Thread templates"
        description="Start new threads from a saved design — engagements, messages and triggers included, dates rebased automatically."
      />
      <TemplatesClient templates={items} teams={teams} initialUseId={useId} />
    </PageContainer>
  );
}
