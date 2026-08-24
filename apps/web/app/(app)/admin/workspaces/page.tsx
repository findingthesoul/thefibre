import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, SectionLabel, EmptyState } from '@/components/ui/page';
import { WorkspaceList, type Workspace } from './list';

export const metadata = { title: 'Workspaces' };

type Me = { user: { is_super_admin?: boolean } };

export default async function AdminWorkspacesPage() {
  // Gate at the page level — the API refuses too, but a clean redirect beats
  // a 403 rendered as an empty screen.
  const me = await apiFetch<Me>('/api/v1/auth/me');
  if (!me.user.is_super_admin) redirect('/dashboard');

  let items: Workspace[] = [];
  let error: string | null = null;
  try {
    const data = await apiFetch<{ items: Workspace[] }>('/api/v1/workspaces');
    items = data.items;
  } catch {
    error = 'Could not load workspaces.';
  }

  const empties = items.filter((w) => w.is_empty).length;

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Workspaces"
        description="Every tenant on the platform. Read-only — a workspace is created by approving an access request, and nothing here deletes one."
      />

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <SectionLabel>
            {items.length} workspace{items.length === 1 ? '' : 's'}
          </SectionLabel>
          {empties > 0 && (
            <span className="text-xs text-ink-muted">
              {empties} nobody has signed into
            </span>
          )}
        </div>

        {error ? <EmptyState>{error}</EmptyState> : <WorkspaceList items={items} />}
      </section>

      <section className="mt-12 border-t border-line pt-6">
        <SectionLabel>Why there is nothing to click here</SectionLabel>
        <div className="mt-3 max-w-2xl space-y-3 text-sm leading-relaxed text-ink-subtle">
          <p>
            A workspace is created in exactly one place: approving an access request on{' '}
            <span className="font-medium text-ink">Access requests</span>. That approval is a
            person reading an application, which is the point of it — so there is no &ldquo;new
            workspace&rdquo; button, here or anywhere.
          </p>
          <p>
            There is no delete either. <code className="font-mono text-xs">workspace_id</code> is
            referenced by 54 tables, so removing one is a cascade you cannot preview from a confirm
            dialog. If you need a workspace gone, it should be provably empty first &mdash; the
            counts above are how you check.
          </p>
          <p>
            An <span className="font-medium text-ink">Empty</span> badge means nobody has ever
            signed into it: no users, no contacts, no activity. That is almost always either a
            workspace approved for someone who has not signed in yet, or one created by mistake.
          </p>
        </div>
      </section>
    </PageContainer>
  );
}
