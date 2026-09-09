'use client';

// Threads overview list with the owner filter (Sjoerd 2026-07-02: "see all,
// but also select teams"). Chips: Everyone · Personal · the workspace · one
// per team.
//
// The workspace chip arrived 2026-09-09 because "Personal" was quietly
// lying. A workspace-scoped thread stores team_id NULL by design
// (docs/brief-workspace-urls.md D1) — that is HOW a workspace thread is
// stored — so `!team_id` swept the whole workspace's threads into one
// person's filter. Ownership here is a three-way, exactly as it is in the
// URL: personal, workspace, or a team.

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarRange, Lock, Route } from 'lucide-react';
import { INTL_LOCALES, type Locale } from '@thefibre/shared';
import { one, type ThreadRow, type TeamOption } from '@/lib/thread-types';
import { EmptyState } from '@/components/ui/page';
import { t, type UiKey } from '@/lib/i18n-ui';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-surface-sunken text-ink-subtle ring-line',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  completed: 'bg-sky-50 text-sky-700 ring-sky-200',
  archived: 'bg-surface-sunken text-ink-muted ring-line',
};

function formatDates(locale: Locale, startsOn: string | null, endsOn: string | null): string {
  if (!startsOn && !endsOn) return t(locale, 'no_dates_yet');
  const fmt = (d: string) =>
    new Intl.DateTimeFormat(INTL_LOCALES[locale], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(d));
  if (startsOn && endsOn && startsOn !== endsOn) return `${fmt(startsOn)} → ${fmt(endsOn)}`;
  return fmt((startsOn ?? endsOn)!);
}

export function ThreadsList({
  locale,
  threads,
  teams,
  workspaceName = null,
}: {
  locale: Locale;
  threads: ThreadRow[];
  teams: TeamOption[];
  /** The workspace's own name, for its chip. Null hides the chip rather
   *  than showing the generic word. */
  workspaceName?: string | null;
}) {
  // 'all' | 'personal' | 'workspace' | team id
  const [filter, setFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft' | 'past'>('all');

  // Only offer team chips for teams that actually own threads (+ all teams
  // so a freshly assigned team is findable).
  const filtered = useMemo(() => {
    let list = threads;
    if (filter === 'personal')
      list = list.filter((t) => !t.team_id && t.public_scope !== 'workspace');
    else if (filter === 'workspace') list = list.filter((t) => t.public_scope === 'workspace');
    else if (filter !== 'all') list = list.filter((t) => t.team_id === filter);
    if (statusFilter !== 'all') {
      list = list.filter((t) => {
        const status = one(t.program)?.status ?? 'draft';
        if (statusFilter === 'past') return status === 'completed' || status === 'archived';
        return status === statusFilter;
      });
    }
    return list;
  }, [threads, filter, statusFilter]);

  const statusChip = (value: 'all' | 'active' | 'draft' | 'past', label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setStatusFilter(value)}
      className={`px-3 py-1.5 rounded-full text-xs ring-1 transition-colors ${
        statusFilter === value
          ? 'bg-ink text-ink-inverse ring-ink'
          : 'bg-surface-raised text-ink-subtle ring-line hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  const chip = (value: string, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setFilter(value)}
      className={`px-3 py-1.5 rounded-full text-xs ring-1 transition-colors ${
        filter === value
          ? 'bg-ink text-ink-inverse ring-ink'
          : 'bg-surface-raised text-ink-subtle ring-line hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {statusChip('all', t(locale, 'filter_all'))}
        {statusChip('active', t(locale, 'filter_active'))}
        {statusChip('draft', t(locale, 'filter_drafts'))}
        {statusChip('past', t(locale, 'filter_past'))}
        {(teams.length > 0 ||
          threads.some((t) => t.team_id || t.public_scope === 'workspace')) && (
          <>
            <span className="mx-1 h-4 w-px bg-line" />
            {chip('all', t(locale, 'filter_everyone'))}
            {chip('personal', t(locale, 'personal'))}
            {workspaceName && chip('workspace', workspaceName)}
            {teams.map((t) => chip(t.id, t.name))}
          </>
        )}
      </div>

      {filtered.length === 0 && (
        <EmptyState>
          {threads.length === 0 ? t(locale, 'threads_empty') : t(locale, 'nothing_for_filter')}
        </EmptyState>
      )}

      {filtered.length > 0 && (
        <ul className="mt-4 divide-y divide-line border border-line rounded-lg bg-surface-raised">
          {filtered.map((row) => {
            const program = one(row.program);
            const team = one(row.team);
            const Icon = program?.format === 'journey' ? Route : CalendarRange;
            const status = program?.status ?? 'draft';
            return (
              <li key={row.id}>
                <Link
                  href={`/threads/${row.id}`}
                  className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-sunken/60 transition-colors"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface-sunken ring-1 ring-line shrink-0">
                    <Icon size={17} strokeWidth={1.75} className="text-ink-subtle" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink truncate">
                      {program?.title ?? row.slug}
                    </div>
                    <div className="text-xs text-ink-subtle mt-0.5">
                      {program?.format === 'journey' ? t(locale, 'journey') : t(locale, 'event')} ·{' '}
                      {formatDates(locale, program?.starts_on ?? null, program?.ends_on ?? null)}
                      {team ? ` · ${team.name}` : ''}
                    </div>
                  </div>
                  {row.locked_at && (
                    <Lock
                      size={13}
                      strokeWidth={1.75}
                      className="text-ink-muted shrink-0"
                      aria-label={t(locale, 'locked')}
                    />
                  )}
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full ring-1 shrink-0 ${
                      STATUS_STYLES[status] ?? STATUS_STYLES.draft
                    }`}
                  >
                    {['draft', 'active', 'completed', 'archived'].includes(status)
                      ? t(locale, `status_${status}` as UiKey)
                      : status}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
