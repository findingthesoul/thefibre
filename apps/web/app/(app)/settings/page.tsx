import Link from 'next/link';
import { appName, type AppId } from '@thefibre/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, SectionLabel, ErrorBanner } from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';

type Me = {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    primary_auth_method: string | null;
    last_sign_in: string | null;
    person_id: string | null;
    is_super_admin?: boolean;
  };
  workspace: {
    id: string;
    slug: string;
    name: string;
    plan: string;
    created_at: string;
  } | null;
  memberships: { app: { slug: string; name: string }; role: string }[];
};

export default async function SettingsPage() {
  let me: Me | null = null;
  let error: string | null = null;
  try {
    me = await apiFetch<Me>('/api/v1/auth/me');
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  const explicitAdmin =
    me?.memberships?.some(
      (m) => m.app.slug === 'fibre-platform' && m.role === 'admin',
    ) ?? false;
  const isWorkspaceAdmin = explicitAdmin || !!me?.user.is_super_admin;

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Settings"
        description="Your profile, your workspace, and your access."
      />

      {error && <ErrorBanner>Couldn't load your settings: {error}</ErrorBanner>}

      {me && (
        <>
          <section className="mt-12">
            <SectionLabel>Profile</SectionLabel>
            <p className="mt-3 text-sm text-ink-subtle">
              Your name, how you sign in, and the public profile every Fibre app
              inherits.
            </p>
            <Link
              href="/settings/profile"
              className="mt-4 flex items-baseline justify-between gap-4 rounded-lg border border-line bg-surface-raised px-5 py-4 hover:bg-surface-sunken"
            >
              <span>
                <span className="font-medium">{me.user.full_name ?? me.user.email}</span>
                <span className="block text-sm text-ink-subtle">{me.user.email}</span>
              </span>
              <span className="shrink-0 text-xs text-ink-muted">Edit &rarr;</span>
            </Link>
          </section>

          <section className="mt-14">
            <div className="flex items-baseline justify-between">
              <SectionLabel>Workspace</SectionLabel>
              {isWorkspaceAdmin && (
                <Link
                  href="/settings/members"
                  className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2"
                >
                  Manage members →
                </Link>
              )}
            </div>
            {me.workspace ? (
              <dl className="mt-3 rounded-lg border border-line bg-surface-raised p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <Row label="Name" value={me.workspace.name} />
                <Row label="Slug" value={me.workspace.slug} mono />
                <Row label="Plan" value={me.workspace.plan} />
                <Row
                  label="Created"
                  value={new Date(me.workspace.created_at).toLocaleDateString('en-GB', {
                    dateStyle: 'medium',
                  })}
                />
              </dl>
            ) : (
              <p className="mt-3 text-sm text-ink-subtle">Not linked to a workspace.</p>
            )}
            <p className="mt-3 text-xs text-ink-muted">
              Multi-workspace switching is on the roadmap. For now your account is bound to one workspace.
            </p>
          </section>

          <section className="mt-14">
            <div className="flex items-baseline justify-between">
              <SectionLabel>App access</SectionLabel>
              {isWorkspaceAdmin && (
                <Link
                  href="/settings/apps"
                  className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2"
                >
                  Manage workspace apps →
                </Link>
              )}
            </div>
            {me.memberships.length === 0 ? (
              <p className="mt-3 text-sm text-ink-subtle">No app memberships.</p>
            ) : (
              <ListGroup>
                {me.memberships.map((m) => (
                  <ListRow
                    key={m.app.slug}
                    primary={appName(m.app.slug as AppId) ?? m.app.name}
                    secondary={m.app.slug}
                    meta={<span className="uppercase">{m.role}</span>}
                  />
                ))}
              </ListGroup>
            )}
          </section>

          <section className="mt-14">
            <SectionLabel>About this platform</SectionLabel>
            <p className="mt-3 text-sm text-ink-subtle">
              What The Fibre holds, what each app holds, and what an app built by
              someone else is allowed to reach — in plain words, with diagrams.
            </p>
            <Link
              href="/settings/about"
              className="mt-4 flex items-baseline justify-between gap-4 rounded-lg border border-line bg-surface-raised px-5 py-4 hover:bg-surface-sunken"
            >
              <span>
                <span className="font-medium">How The Fibre works</span>
                <span className="block text-sm text-ink-subtle">
                  The data wall, the three crossings, and the whole app contract
                </span>
              </span>
              <span className="shrink-0 text-xs text-ink-muted">Read &rarr;</span>
            </Link>
          </section>

          <section className="mt-14">
            <SectionLabel>Privacy</SectionLabel>
            <p className="mt-3 text-sm text-ink-subtle">
              Consent records, data subject requests, and erasure live on the{' '}
              <Link href="/privacy" className="underline">Privacy page</Link>.
            </p>
          </section>
        </>
      )}
    </PageContainer>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className={`mt-1 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
