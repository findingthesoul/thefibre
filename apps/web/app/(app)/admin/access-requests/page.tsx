import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, SectionLabel, EmptyState } from '@/components/ui/page';
import { DecideButtons } from './decide';

type SignupRequest = {
  id: string;
  email: string;
  full_name: string;
  organisation_name: string | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'denied';
  workspace_id: string | null;
  created_at: string;
  decided_at: string | null;
};

type Me = {
  user: { is_super_admin?: boolean };
  memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[];
};

export default async function AdminAccessRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = 'pending' } = await searchParams;

  // Gate at the page level — RLS will also reject non-super-admins, but a
  // clean 403-style redirect is nicer than a 500 from the API.
  const me = await apiFetch<Me>('/api/v1/auth/me');
  if (!me.user.is_super_admin) redirect('/dashboard');

  let items: SignupRequest[] = [];
  try {
    const data = await apiFetch<{ items: SignupRequest[] }>(
      `/api/v1/signup-requests?status=${encodeURIComponent(status)}`,
    );
    items = data.items;
  } catch {
    // Non-fatal — show empty.
  }

  const counts = {
    pending: 'Pending review',
    approved: 'Approved',
    denied: 'Denied',
  } as const;

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Access requests"
        description="Applications to join The Fibre. Approval provisions a new workspace; the applicant lands in it the next time they sign in."
      />

      <nav className="mt-4 flex items-center gap-4 text-sm">
        {(['pending', 'approved', 'denied'] as const).map((s) => (
          <a
            key={s}
            href={`/admin/access-requests?status=${s}`}
            className={
              s === status
                ? 'text-ink font-medium underline underline-offset-4'
                : 'text-ink-subtle hover:text-ink'
            }
          >
            {counts[s]}
          </a>
        ))}
      </nav>

      <section className="mt-8">
        <SectionLabel>{counts[status as keyof typeof counts] ?? status}</SectionLabel>

        {items.length === 0 ? (
          <EmptyState>No {status} requests.</EmptyState>
        ) : (
          <ul className="mt-4 divide-y divide-line border border-line rounded-lg bg-surface-raised overflow-hidden">
            {items.map((r) => (
              <li key={r.id} className="p-5">
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-sm text-ink-subtle">{r.email}</div>
                    {r.organisation_name && (
                      <div className="text-sm mt-1">{r.organisation_name}</div>
                    )}
                    {r.reason && (
                      <p className="mt-3 text-sm whitespace-pre-wrap text-ink-subtle">
                        {r.reason}
                      </p>
                    )}
                    <div className="mt-3 text-[10px] uppercase tracking-wider text-ink-muted">
                      {new Date(r.created_at).toLocaleString('en-GB', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </div>
                  </div>

                  {r.status === 'pending' ? (
                    <DecideButtons requestId={r.id} />
                  ) : (
                    <div className="text-xs uppercase tracking-wider text-ink-muted">
                      {r.status}
                      {r.workspace_id && (
                        <div className="mt-1 font-mono text-[10px] text-ink-muted/70">
                          ws {r.workspace_id.slice(0, 8)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
