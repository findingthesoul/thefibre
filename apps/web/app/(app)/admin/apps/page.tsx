import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader, SectionLabel, EmptyState } from '@/components/ui/page';
import { ReviewButtons } from './review';

type App = {
  id: string;
  slug: string;
  name: string;
  base_url: string | null;
  homepage_url: string | null;
  description: string | null;
  contact_email: string | null;
  status: 'pending' | 'approved' | 'suspended';
  kind: 'first_party' | 'third_party';
  manifest: Record<string, unknown> | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
};

type Me = { user: { is_super_admin?: boolean } };

const TABS = {
  pending: 'Pending review',
  approved: 'Approved',
  suspended: 'Suspended',
} as const;

function manifestScopes(m: Record<string, unknown> | null): string[] {
  const raw = m?.scopes_requested;
  return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string') : [];
}

function manifestActivityTypes(m: Record<string, unknown> | null): string[] {
  const raw = m?.activity_types;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => (typeof t === 'string' ? t : (t as { type?: unknown })?.type))
    .filter((t): t is string => typeof t === 'string');
}

export default async function AdminAppsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = 'pending' } = await searchParams;

  // Gate at the page level — the API checks super-admin too, but a redirect
  // reads better than a 403.
  const me = await apiFetch<Me>('/api/v1/auth/me');
  if (!me.user.is_super_admin) redirect('/dashboard');

  let items: App[] = [];
  try {
    const data = await apiFetch<{ items: App[] }>(
      `/api/v1/apps?status=${encodeURIComponent(status)}`,
    );
    items = data.items;
  } catch {
    // Non-fatal — show empty.
  }

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Apps"
        description="Registrations from apps outside the monorepo. Approving one lets workspace admins activate it and mint a key scoped to their workspace; it does not grant it any data by itself."
      />

      <nav className="mt-4 flex items-center gap-4 text-sm">
        {(Object.keys(TABS) as (keyof typeof TABS)[]).map((s) => (
          <a
            key={s}
            href={`/admin/apps?status=${s}`}
            className={
              s === status
                ? 'text-ink font-medium underline underline-offset-4'
                : 'text-ink-subtle hover:text-ink'
            }
          >
            {TABS[s]}
          </a>
        ))}
      </nav>

      <section className="mt-8">
        <SectionLabel>{TABS[status as keyof typeof TABS] ?? status}</SectionLabel>

        {items.length === 0 ? (
          <EmptyState>No {status} apps.</EmptyState>
        ) : (
          <ul className="mt-4 divide-y divide-line border border-line rounded-lg bg-surface-raised overflow-hidden">
            {items.map((a) => {
              const scopes = manifestScopes(a.manifest);
              const types = manifestActivityTypes(a.manifest);
              return (
                <li key={a.id} className="p-5">
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-3">
                        <span className="font-medium">{a.name}</span>
                        <span className="font-mono text-xs text-ink-muted">{a.slug}</span>
                        {a.kind === 'third_party' && (
                          <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                            third party
                          </span>
                        )}
                      </div>
                      {a.contact_email && (
                        <div className="text-sm text-ink-subtle">{a.contact_email}</div>
                      )}
                      {a.description && (
                        <p className="mt-3 text-sm whitespace-pre-wrap text-ink-subtle max-w-2xl leading-relaxed">
                          {a.description}
                        </p>
                      )}
                      {(a.homepage_url ?? a.base_url) && (
                        <div className="mt-2 text-sm">
                          <a
                            href={a.homepage_url ?? a.base_url ?? '#'}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-ink-subtle underline underline-offset-2 hover:text-ink"
                          >
                            {a.homepage_url ?? a.base_url}
                          </a>
                        </div>
                      )}

                      {scopes.length > 0 && (
                        <div className="mt-4">
                          <div className="text-[10px] uppercase tracking-wider text-ink-muted">
                            Scopes requested
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {scopes.map((s) => (
                              <span
                                key={s}
                                className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-subtle"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {types.length > 0 && (
                        <div className="mt-3">
                          <div className="text-[10px] uppercase tracking-wider text-ink-muted">
                            Activity types it may write
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {types.map((t) => (
                              <span
                                key={t}
                                className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-subtle"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 text-[10px] uppercase tracking-wider text-ink-muted">
                        {a.submitted_at
                          ? `Submitted ${new Date(a.submitted_at).toLocaleString('en-GB', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}`
                          : `Created ${new Date(a.created_at).toLocaleDateString('en-GB', {
                              dateStyle: 'medium',
                            })}`}
                      </div>
                    </div>

                    <ReviewButtons slug={a.slug} status={a.status} kind={a.kind} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
