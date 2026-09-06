import { ExternalLink } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import {
  PageContainer,
  PageHeader,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';

type TeamItem = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  workspace_role: string;
  relationship_type: string;
  thread_role: 'admin' | 'member' | null;
};

export default async function InternalTeamPage() {
  const locale = await uiLocale();
  const threadRoleLabels: Record<'admin' | 'member', string> = {
    admin: t(locale, 'thread_admin'),
    member: t(locale, 'thread_member'),
  };
  let items: TeamItem[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: TeamItem[] }>('/api/v1/thread/internal-team');
    items = r.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <PageHeader
        title={t(locale, 'internal_team')}
        description={t(locale, 'internal_team_desc')}
      />

      {/* Membership is managed at platform level — the single point of truth
          (docs/platform-spot-members-profile.md). */}
      <a
        href="https://thefibre.app/settings/members"
        target="_blank"
        rel="noreferrer"
        className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-surface-raised px-4 py-3 text-sm text-ink-subtle hover:text-ink hover:border-line-strong transition-colors"
      >
        {t(locale, 'internal_managed_pre')} <span className="font-medium">The Fibre</span>{' '}
        {t(locale, 'internal_managed_post')}
        <ExternalLink size={14} strokeWidth={1.75} className="ml-auto shrink-0" />
      </a>

      {error && <ErrorBanner>{t(locale, 'couldnt_load', { error })}</ErrorBanner>}

      {!error && items.length === 0 && (
        <EmptyState>{t(locale, 'no_workspace_members')}</EmptyState>
      )}

      {items.length > 0 && (
        <ul className="mt-6 divide-y divide-line border border-line rounded-lg bg-surface-raised">
          {items.map((it) => {
            const name = it.full_name || it.email || t(locale, 'unknown');
            return (
              <li key={it.user_id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{name}</div>
                  <div className="text-xs text-ink-subtle mt-0.5 truncate">{it.email}</div>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-line bg-surface-sunken text-ink-subtle capitalize shrink-0">
                  {it.workspace_role}
                </span>
                <div className="shrink-0">
                  {it.thread_role ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-emerald-200 bg-emerald-50 text-emerald-700">
                      {threadRoleLabels[it.thread_role]}
                    </span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-line bg-surface text-ink-muted">
                      {t(locale, 'no_access')}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
