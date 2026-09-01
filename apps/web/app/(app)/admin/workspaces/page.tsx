import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, SectionLabel, EmptyState } from '@/components/ui/page';
import { WorkspaceList, type Workspace, type PlanOption } from './list';
import { NewWorkspaceButton } from './new-workspace';

export const metadata = { title: 'Workspaces' };

type Me = { user: { is_super_admin?: boolean } };

export default async function AdminWorkspacesPage() {
  // Gate at the page level — the API refuses too, but a clean redirect beats
  // a 403 rendered as an empty screen.
  const me = await apiFetch<Me>('/api/v1/auth/me');
  if (!me.user.is_super_admin) redirect('/dashboard');

  let items: Workspace[] = [];
  let plans: PlanOption[] = [];
  let error: string | null = null;
  try {
    const [ws, pl] = await Promise.all([
      apiFetch<{ items: Workspace[] }>('/api/v1/workspaces'),
      apiFetch<{ plans: PlanOption[] }>('/api/v1/admin/plans'),
    ]);
    items = ws.items;
    plans = pl.plans;
  } catch {
    error = 'Could not load workspaces.';
  }

  const empties = items.filter((w) => w.is_empty).length;

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Workspaces"
        description="Every tenant on the platform: who they are, what plan they sit on, and the levers for tailored deals."
        actions={<NewWorkspaceButton plans={plans} />}
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

        {error ? <EmptyState>{error}</EmptyState> : <WorkspaceList items={items} plans={plans} />}
      </section>

      <section className="mt-12 border-t border-line pt-6">
        <SectionLabel>The two doors, and the missing third</SectionLabel>
        <div className="mt-3 max-w-2xl space-y-3 text-sm leading-relaxed text-ink-subtle">
          <p>
            A workspace comes into being in exactly two ways: approving an application on{' '}
            <span className="font-medium text-ink">Access requests</span> (the door for people who
            ask), or the <span className="font-medium text-ink">New workspace</span> button above
            (the door for organisations we invite — with their plan, comp or tailored price set at
            creation). Both are a person deciding, which is the point.
          </p>
          <p>
            There is still no delete. <code className="font-mono text-xs">workspace_id</code> is
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
