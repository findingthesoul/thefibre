import Link from 'next/link';
import { Users } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';
import { ButtonLink } from '@/components/ui/button';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';

const THREAD_HOST =
  process.env.NEXT_PUBLIC_THREAD_URL?.replace(/^https?:\/\//, '') ?? 'app.thethread.app';

type TeamListItem = { id: string; name: string; slug: string };

export default async function TeamsPage() {
  const locale = await uiLocale();
  let teams: TeamListItem[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: TeamListItem[] }>('/api/v1/thread/teams');
    teams = r.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <PageHeader
        title={t(locale, 'teams')}
        description={t(locale, 'teams_desc')}
        actions={<ButtonLink href="/teams/new">{t(locale, 'new_team')}</ButtonLink>}
      />

      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}

      {!error && teams.length === 0 && <EmptyState>{t(locale, 'teams_empty')}</EmptyState>}

      {teams.length > 0 && (
        <ul className="mt-6 divide-y divide-line border border-line rounded-lg bg-surface-raised">
          {teams.map((t) => (
            <li key={t.id}>
              <Link
                href={`/teams/${t.id}`}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-sunken/60 transition-colors"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface-sunken ring-1 ring-line shrink-0">
                  <Users size={17} strokeWidth={1.75} className="text-ink-subtle" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink truncate">{t.name}</div>
                  <div className="text-xs text-ink-subtle mt-0.5 truncate">
                    {THREAD_HOST}/{t.slug}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
