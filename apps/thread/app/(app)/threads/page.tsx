import Link from 'next/link';
import { CalendarRange, Route } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { one, type ThreadRow } from '@/lib/thread-types';
import {
  PageContainer,
  PageHeader,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';
import { ButtonLink } from '@/components/ui/button';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-surface-sunken text-ink-subtle ring-line',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  completed: 'bg-sky-50 text-sky-700 ring-sky-200',
  archived: 'bg-surface-sunken text-ink-muted ring-line',
};

function formatDates(startsOn: string | null, endsOn: string | null): string {
  if (!startsOn && !endsOn) return 'No dates yet';
  const fmt = (d: string) =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(d),
    );
  if (startsOn && endsOn && startsOn !== endsOn) return `${fmt(startsOn)} → ${fmt(endsOn)}`;
  return fmt((startsOn ?? endsOn)!);
}

export default async function ThreadsPage() {
  let threads: ThreadRow[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: ThreadRow[] }>('/api/v1/thread/threads');
    threads = r.items;
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

      {!error && threads.length === 0 && (
        <EmptyState>
          No threads yet. Create your first — an event with a schedule, or a
          journey that unfolds over time.
        </EmptyState>
      )}

      {threads.length > 0 && (
        <ul className="mt-6 divide-y divide-line border border-line rounded-lg bg-surface-raised">
          {threads.map((t) => {
            const program = one(t.program);
            const Icon = program?.format === 'journey' ? Route : CalendarRange;
            const status = program?.status ?? 'draft';
            return (
              <li key={t.id}>
                <Link
                  href={`/threads/${t.id}`}
                  className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-sunken/60 transition-colors"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface-sunken ring-1 ring-line shrink-0">
                    <Icon size={17} strokeWidth={1.75} className="text-ink-subtle" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink truncate">
                      {program?.title ?? t.slug}
                    </div>
                    <div className="text-xs text-ink-subtle mt-0.5">
                      {program?.format === 'journey' ? 'Journey' : 'Event'} ·{' '}
                      {formatDates(program?.starts_on ?? null, program?.ends_on ?? null)}
                    </div>
                  </div>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full ring-1 capitalize shrink-0 ${
                      STATUS_STYLES[status] ?? STATUS_STYLES.draft
                    }`}
                  >
                    {status}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
