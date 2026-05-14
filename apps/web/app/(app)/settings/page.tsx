import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, PageHeader, SectionLabel, ErrorBanner } from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';
import { ProfileForm } from './profile-form';

type Me = {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    primary_auth_method: string | null;
    last_sign_in: string | null;
    person_id: string | null;
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

const APP_LABEL: Record<string, string> = {
  'fibre-platform': 'The Fibre Platform',
  'fibre-meet': 'Fibre Meet',
  'the-thread': 'The Thread',
  'fibre-sales': 'Fibre Sales',
  'fibre-learn': 'Fibre Learn',
};

export default async function SettingsPage() {
  let me: Me | null = null;
  let error: string | null = null;
  try {
    me = await apiFetch<Me>('/api/v1/auth/me');
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

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
            <ProfileForm me={me.user} />
            <div className="mt-6 text-xs text-ink-muted space-y-1">
              <div>
                <span className="uppercase tracking-wider">Email</span>{' '}
                · {me.user.email}{' '}
                <span className="text-ink-muted">— managed by your identity provider</span>
              </div>
              <div>
                <span className="uppercase tracking-wider">Sign-in method</span>{' '}
                · {me.user.primary_auth_method ?? '—'}
              </div>
              {me.user.last_sign_in && (
                <div>
                  <span className="uppercase tracking-wider">Last sign-in</span>{' '}
                  ·{' '}
                  {new Date(me.user.last_sign_in).toLocaleString('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="mt-14">
            <SectionLabel>Workspace</SectionLabel>
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
            <SectionLabel>App access</SectionLabel>
            {me.memberships.length === 0 ? (
              <p className="mt-3 text-sm text-ink-subtle">No app memberships.</p>
            ) : (
              <ListGroup>
                {me.memberships.map((m) => (
                  <ListRow
                    key={m.app.slug}
                    primary={APP_LABEL[m.app.slug] ?? m.app.name}
                    secondary={m.app.slug}
                    meta={<span className="uppercase">{m.role}</span>}
                  />
                ))}
              </ListGroup>
            )}
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
