import { apiFetch, ApiError } from '@/lib/api';
import type { ThreadRow, TeamOption } from '@/lib/thread-types';
import { PageContainer, PageHeader, ErrorBanner } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { ThreadsList } from './threads-list';
import { NewThreadButton } from './new-thread-button';

export default async function ThreadsPage() {
  const locale = await uiLocale();
  let threads: ThreadRow[] = [];
  let teams: TeamOption[] = [];
  let templates: { id: string; title: string }[] = [];
  // The workspace's own name — it is one of the owner filters, so the chip
  // has to say "soul.com" rather than the word "workspace" (Sjoerd
  // 2026-09-09). Failing to load it just drops the chip.
  let workspaceName: string | null = null;
  let error: string | null = null;
  try {
    const [t, tm, tpl, brand] = await Promise.all([
      apiFetch<{ items: ThreadRow[] }>('/api/v1/thread/threads'),
      apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams').catch(() => ({
        items: [] as TeamOption[],
      })),
      apiFetch<{ items: { id: string; title: string }[] }>(
        '/api/v1/thread/thread-templates',
      ).catch(() => ({ items: [] as { id: string; title: string }[] })),
      apiFetch<{ name: string | null }>('/api/v1/workspace-brand').catch(() => ({
        name: null,
      })),
    ]);
    threads = t.items;
    teams = tm.items;
    templates = tpl.items;
    workspaceName = brand.name;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <PageHeader
        title={t(locale, 'threads')}
        description={t(locale, 'threads_desc')}
        actions={<NewThreadButton locale={locale} templates={templates} />}
      />

      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}

      {!error && (
        <ThreadsList
          locale={locale}
          threads={threads}
          teams={teams}
          workspaceName={workspaceName}
        />
      )}
    </PageContainer>
  );
}
