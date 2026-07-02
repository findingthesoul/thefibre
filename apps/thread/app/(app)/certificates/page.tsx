import Link from 'next/link';
import { Award } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import type { TeamOption } from '@/lib/thread-types';
import {
  PAGE_SIZE_LABELS,
  type CertScope,
  type CertTemplate,
} from '@/lib/certificate-types';
import {
  PageContainer,
  PageHeader,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';
import { NewTemplateDialog } from './new-template-dialog';

const SCOPE_STYLES: Record<CertScope, string> = {
  personal: 'bg-surface-sunken text-ink-subtle ring-line',
  team: 'bg-sky-50 text-sky-700 ring-sky-200',
  workspace: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

const SCOPE_LABELS: Record<CertScope, string> = {
  personal: 'Personal',
  team: 'Team',
  workspace: 'Workspace',
};

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export default async function CertificatesPage() {
  let templates: CertTemplate[] = [];
  let error: string | null = null;
  let teams: TeamOption[] = [];
  try {
    const [t, tm] = await Promise.all([
      apiFetch<{ items: CertTemplate[] }>('/api/v1/thread/certificate-templates'),
      apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams').catch(() => ({
        items: [] as TeamOption[],
      })),
    ]);
    templates = t.items;
    teams = tm.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <PageHeader
        title="Certificates"
        description="Design certificate templates — threads pick one and issue it on completion."
        actions={<NewTemplateDialog teams={teams} />}
      />

      {error && <ErrorBanner>Couldn&apos;t load templates: {error}</ErrorBanner>}

      {!error && templates.length === 0 && (
        <EmptyState>
          No templates yet. Create your first — pick a page size, drop in the
          recipient&apos;s name and the thread title, and threads can start
          issuing it.
        </EmptyState>
      )}

      {templates.length > 0 && (
        <ul className="mt-6 divide-y divide-line border border-line rounded-lg bg-surface-raised">
          {[...templates]
            .sort((a, b) => Number(!!a.archived_at) - Number(!!b.archived_at))
            .map((t) => (
            <li key={t.id}>
              <Link
                href={`/certificates/${t.id}`}
                className={`flex items-center gap-4 px-4 py-3.5 hover:bg-surface-sunken/60 transition-colors ${
                  t.archived_at ? 'opacity-55' : ''
                }`}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface-sunken ring-1 ring-line shrink-0">
                  <Award size={17} strokeWidth={1.75} className="text-ink-subtle" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink truncate">{t.name}</span>
                    {t.archived_at && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-line bg-surface-sunken text-ink-muted shrink-0">
                        Archived
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-subtle mt-0.5">
                    {PAGE_SIZE_LABELS[t.page_size] ?? t.page_size} ·{' '}
                    <span className="capitalize">{t.orientation}</span> · Updated{' '}
                    {fmtDate(t.updated_at)}
                  </div>
                </div>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ring-1 shrink-0 ${
                    SCOPE_STYLES[t.scope] ?? SCOPE_STYLES.personal
                  }`}
                >
                  {SCOPE_LABELS[t.scope] ?? t.scope}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
