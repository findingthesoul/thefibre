import { apiFetch, ApiError } from '@/lib/api';
import type { ThreadRow, TeamOption } from '@/lib/thread-types';
import { PageContainer, PageHeader, ErrorBanner } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { ThreadsList } from './threads-list';
import { toStatusFilter } from '@/lib/thread-status-filter';
import { NewThreadButton } from './new-thread-button';
import { HandoverPanel } from './[id]/handover-panel';
import { HandoverBatchBar } from './handover-batch-bar';
import { DepartedHandover } from './departed-handover';
import type { DepartedOrganiser, HandoverItem } from './actions';
import type { WorkspaceMember } from '@/lib/thread-types';

/** Open incoming rows grouped by batch — only batches with more than one
 *  open thread; a single one is answered on its own card. */
function batches(items: HandoverItem[]): Map<string, HandoverItem[]> {
  const out = new Map<string, HandoverItem[]>();
  for (const h of items) if (h.batch_id) out.set(h.batch_id, [...(out.get(h.batch_id) ?? []), h]);
  for (const [k, v] of out) if (v.length < 2) out.delete(k);
  return out;
}

export default async function ThreadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  // The status chip opens on Active (Sjoerd, 2026-10-17: "Show active as
  // default"); a choice in the address (?status=all, a link, the back
  // button) still wins.
  const { status: statusParam } = await searchParams;
  const locale = await uiLocale();
  let threads: ThreadRow[] = [];
  let teams: TeamOption[] = [];
  let templates: { id: string; title: string }[] = [];
  // The workspace's own name — it is one of the owner filters, so the chip
  // has to say "soul.com" rather than the word "workspace" (Sjoerd
  // 2026-09-09). Failing to load it just drops the chip.
  let workspaceName: string | null = null;
  let error: string | null = null;
  // Requests to take over somebody's thread, waiting for THIS person's answer
  // (organiser handover). The proposal email links here, so they are first.
  let incoming: HandoverItem[] = [];
  // Organisers who have LEFT and still own threads: admins only (the API
  // answers 403 for anyone else, which simply hides the door).
  let departed: DepartedOrganiser[] = [];
  let members: WorkspaceMember[] = [];
  try {
    const [t, tm, tpl, brand, ho, dep, mem] = await Promise.all([
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
      apiFetch<{ items: HandoverItem[] }>('/api/v1/thread/handovers').catch(() => ({ items: [] as HandoverItem[] })),
      apiFetch<{ items: DepartedOrganiser[] }>('/api/v1/thread/handovers/departed').catch(() => ({
        items: [] as DepartedOrganiser[],
      })),
      apiFetch<{ items: WorkspaceMember[] }>('/api/v1/thread/workspace-members').catch(() => ({
        items: [] as WorkspaceMember[],
      })),
    ]);
    incoming = ho.items.filter((h) => h.incoming && h.status === 'pending');
    departed = dep.items;
    members = mem.items;
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

      {departed.length > 0 && (
        <DepartedHandover locale={locale} departed={departed} workspaceMembers={members} />
      )}

      {/* A request for several threads gets one bar to answer them all;
          each thread keeps its own card below it. */}
      {[...batches(incoming)].map(([batchId, rows]) => (
        <HandoverBatchBar
          key={batchId}
          locale={locale}
          batchId={batchId}
          fromName={rows[0]!.from_name ?? '—'}
          count={rows.length}
          reason={rows[0]!.reason}
        />
      ))}

      {incoming.map((h) => (
        <HandoverPanel
          key={h.id}
          locale={locale}
          threadId={h.thread_id}
          organiserUserId={null}
          meUserId={null}
          isAdmin={false}
          workspaceMembers={[]}
          pending={h}
        />
      ))}

      {!error && (
        <ThreadsList
          initialStatus={toStatusFilter(statusParam)}
          locale={locale}
          threads={threads}
          teams={teams}
          workspaceName={workspaceName}
        />
      )}
    </PageContainer>
  );
}
