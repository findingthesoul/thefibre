import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';
import { GrantAccessButton } from './grant-access-button';

type TeamItem = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  workspace_role: string;
  relationship_type: string;
  thread_role: 'admin' | 'member' | null;
};

const THREAD_ROLE_LABELS: Record<'admin' | 'member', string> = {
  admin: 'Thread admin',
  member: 'Thread member',
};

export default async function InternalTeamPage() {
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
        title="Internal team"
        description="Who in the workspace can use The Thread."
      />

      {error && <ErrorBanner>Couldn&apos;t load the team: {error}</ErrorBanner>}

      {!error && items.length === 0 && (
        <EmptyState>No workspace members found.</EmptyState>
      )}

      {items.length > 0 && (
        <ul className="mt-6 divide-y divide-line border border-line rounded-lg bg-surface-raised">
          {items.map((it) => {
            const name = it.full_name || it.email || 'Unknown';
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
                      {THREAD_ROLE_LABELS[it.thread_role]}
                    </span>
                  ) : (
                    <GrantAccessButton userId={it.user_id} />
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
